import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function asArray<T = any>(x: any): T[] {
  return Array.isArray(x) ? x : [];
}
function asString(x: any, fallback = "") {
  return typeof x === "string" ? x : fallback;
}
function stripUndefined(obj: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
function safeObj(x: any) {
  return x && typeof x === "object" ? x : {};
}

function safeStructured(x: any) {
  if (x && typeof x === "object") return x;
  if (typeof x === "string") {
    try {
      const parsed = JSON.parse(x);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

type CardImageAsset = {
  kind: "card-image";
  bucket: "card-images";
  oldCardId: string;
  oldPath: string;
  contentType: string | null;
  base64: string;
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  // --- Parse input (supports both JSON and multipart/form-data) ---
  let dump: any = null;
  let newCampaignName = "Imported campaign";

  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    newCampaignName = asString(fd.get("name"), newCampaignName).trim() || newCampaignName;

    const file = fd.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const text = await file.text();
    try {
      dump = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "File is not valid JSON" }, { status: 400 });
    }
  } else {
    const body = await req.json().catch(() => ({}));
    dump = body?.dump ?? body?.export ?? body;
    newCampaignName = asString(body?.name, newCampaignName).trim() || newCampaignName;
  }

  if (!dump || typeof dump !== "object") {
    return NextResponse.json({ error: "Invalid export payload" }, { status: 400 });
  }

  const version = Number(dump?.version ?? 1);

  // v2 puts stuff in dump.tables; v1 uses top-level arrays
  const tables = safeObj(dump?.tables);
  const charactersIn = asArray(version >= 2 ? tables.characters : dump.characters);
  const decksIn = asArray(version >= 2 ? tables.decks : dump.decks);
  const deckCardsIn = asArray(version >= 2 ? tables.deck_cards : dump.deck_cards);
  const cardsIn = asArray(version >= 2 ? tables.cards : dump.cards);
  const monstersIn = asArray(version >= 2 ? tables.monsters : dump.monsters);
  const bestiaryIn = asArray(version >= 2 ? tables.bestiary_entries : (dump.bestiary_entries ?? dump.bestiaryEntries ?? dump.bestiary));
  const assetsIn = asArray<CardImageAsset>(dump?.assets);

  // --- 1) Create new campaign ---
  const newCampaignId = crypto.randomUUID();

  const { error: campErr } = await supabase.from("campaigns").insert({
    id: newCampaignId,
    name: newCampaignName,
    owner_user_id: user.id,
  });
  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 400 });

  // Make importer DM member
  const { error: memberErr } = await supabase.from("campaign_members").insert({
    campaign_id: newCampaignId,
    user_id: user.id,
    role: "dm",
  });
  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 400 });

  // --- 2) ID maps ---
  const characterIdMap = new Map<string, string>();
  const monsterIdMap = new Map<string, string>();
  const cardIdMap = new Map<string, string>();
  const deckIdMap = new Map<string, string>();

  // --- 3) Characters (new IDs, user_id cleared) ---
  const charactersRows = charactersIn.map((p: any) => {
    const oldId = asString(p?.id);
    const newId = crypto.randomUUID();
    if (oldId) characterIdMap.set(oldId, newId);

    return stripUndefined({
      id: newId,
      campaign_id: newCampaignId,
      user_id: null,
      name: asString(p?.name, "Character"),
      sheet: safeObj(p?.sheet),
    });
  });

  if (charactersRows.length) {
    const { error } = await supabase.from("characters").insert(charactersRows);
    if (error) return NextResponse.json({ error: `Characters: ${error.message}` }, { status: 400 });
  }

  // --- 4) Monsters (new IDs) ---
  const monstersRows = monstersIn.map((m: any) => {
    const oldId = asString(m?.id);
    const newId = crypto.randomUUID();
    if (oldId) monsterIdMap.set(oldId, newId);

    return stripUndefined({
      id: newId,
      campaign_id: newCampaignId,
      name: asString(m?.name, "Monster"),
      tags: Array.isArray(m?.tags) ? m.tags : [],
      gm_notes: m?.gm_notes ?? null,
      data: safeObj(m?.data),
    });
  });

  if (monstersRows.length) {
    const { error } = await supabase.from("monsters").insert(monstersRows);
    if (error) return NextResponse.json({ error: `Monsters: ${error.message}` }, { status: 400 });
  }

  // --- 5) Cards (new IDs) ---
  const cardsRows = cardsIn.map((c: any) => {
    const oldId = asString(c?.id);
    const newId = crypto.randomUUID();
    if (oldId) cardIdMap.set(oldId, newId);

    const rulesText = asString(c?.rules_text, asString(c?.rules, ""));
    const structured = safeObj(c?.structured);

    return stripUndefined({
      id: newId,
      campaign_id: newCampaignId,
      name: asString(c?.name, "Card"),
      type: asString(c?.type, ""),
      tier: Number.isFinite(Number(c?.tier)) ? Number(c?.tier) : null,
      cost: Number.isFinite(Number(c?.cost)) ? Number(c?.cost) : null,
      tags: Array.isArray(c?.tags) ? c.tags : [],
      rules_text: rulesText,
      structured,

      // include these if present in export
      encounter_type: asString(c?.encounter_type, "combat"),
      rarity: asString(c?.rarity, "common"),
      description: asString(c?.description, ""),
      max_owned: Number.isFinite(Number(c?.max_owned)) ? Number(c?.max_owned) : 1,

      // don’t set image_path yet; we restore it from assets (if any)
      image_path: null,
    });
  });

  if (cardsRows.length) {
    const { error } = await supabase.from("cards").insert(cardsRows);
    if (error) return NextResponse.json({ error: `Cards: ${error.message}` }, { status: 400 });
  }

  // --- 6) Decks (new IDs, remap character_id) ---
  const decksRows = decksIn.map((d: any) => {
    const oldDeckId = asString(d?.id);
    const newDeckId = crypto.randomUUID();
    if (oldDeckId) deckIdMap.set(oldDeckId, newDeckId);

    const oldCharacterId = asString(d?.character_id);
    const newCharacterId = oldCharacterId ? characterIdMap.get(oldCharacterId) ?? null : null;

    return stripUndefined({
      id: newDeckId,
      campaign_id: newCampaignId,
      character_id: newCharacterId,
      deck_type: asString(d?.deck_type, "combat"),
      name: d?.name ?? null,
    });
  });

  if (decksRows.length) {
    const { error } = await supabase.from("decks").insert(decksRows);
    if (error) return NextResponse.json({ error: `Decks: ${error.message}` }, { status: 400 });
  }

  // --- 7) Deck cards (remap deck_id + card_id) ---
  // This is why decks previously imported “empty”
  const deckCardsRows = deckCardsIn
    .map((dc: any) => {
      const oldDeckId = asString(dc?.deck_id);
      const oldCardId = asString(dc?.card_id);

      const newDeckId = oldDeckId ? deckIdMap.get(oldDeckId) : null;
      const newCardId = oldCardId ? cardIdMap.get(oldCardId) : null;
      if (!newDeckId || !newCardId) return null;

      const qty = Number(dc?.quantity ?? dc?.qty ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) return null;

      return {
        deck_id: newDeckId,
        card_id: newCardId,
        quantity: qty,
      };
    })
    .filter(Boolean) as any[];

  if (deckCardsRows.length) {
    const { error } = await supabase.from("deck_cards").insert(deckCardsRows);
    if (error) return NextResponse.json({ error: `Deck cards: ${error.message}` }, { status: 400 });
  }

  // --- 8) Bestiary (remap character_id + monster_id + revealed.monsterId) ---
  const bestiaryRows = bestiaryIn
    .map((e: any) => {
      const oldCharacterId = asString(e?.character_id);
      const oldMonsterId = asString(e?.monster_id);

      const newCharacterId = oldCharacterId ? characterIdMap.get(oldCharacterId) : null;
      const newMonsterId = oldMonsterId ? monsterIdMap.get(oldMonsterId) : null;

      if (!newCharacterId || !newMonsterId) return null;

      const revealed = safeObj(e?.revealed);
      if (typeof revealed.monsterId === "string") revealed.monsterId = newMonsterId;

      const rl = Number(e?.reveal_level ?? e?.revealLevel ?? 1);
      const reveal_level = [1, 2, 3].includes(rl) ? rl : 1;

      return stripUndefined({
        campaign_id: newCampaignId,
        character_id: newCharacterId,
        monster_id: newMonsterId,
        category: asString(e?.category, "Unsorted"),
        reveal_level,
        revealed,
      });
    })
    .filter(Boolean) as any[];

  if (bestiaryRows.length) {
    const { error } = await supabase
      .from("bestiary_entries")
      .upsert(bestiaryRows, { onConflict: "character_id,monster_id" });

    if (error) return NextResponse.json({ error: `Bestiary: ${error.message}` }, { status: 400 });
  }

  // --- 9) Restore card images from assets (v2 only) ---
  // Requires Storage policies to allow DM to upload to card-images bucket.
  let restoredImages = 0;

  const cardImageAssets = assetsIn.filter((a) => a?.kind === "card-image" && a?.bucket === "card-images");

  for (const a of cardImageAssets) {
    const newCardId = cardIdMap.get(asString(a.oldCardId));
    if (!newCardId) continue;

    const bytes = Buffer.from(asString(a.base64), "base64");

    const filename = a.oldPath.split("/").pop() || `${newCardId}.png`;
    const newPath = `${newCampaignId}/${newCardId}-${Date.now()}-${filename}`;

    const { error: upErr } = await supabase.storage.from("card-images").upload(newPath, bytes, {
      upsert: true,
      contentType: a.contentType || "image/png",
      cacheControl: "3600",
    });

    if (upErr) continue;

    // Update BOTH: real column + structured.image_path (backward compat)
    const { data: cardRow } = await supabase
      .from("cards")
      .select("structured")
      .eq("id", newCardId)
      .eq("campaign_id", newCampaignId)
      .maybeSingle();

    const structured = safeStructured(cardRow?.structured);
    const nextStructured = { ...structured, image_path: newPath };

    const { error: writeErr } = await supabase
      .from("cards")
      .update({ image_path: newPath, structured: nextStructured })
      .eq("id", newCardId)
      .eq("campaign_id", newCampaignId);

    if (!writeErr) restoredImages += 1;
  }

  return NextResponse.json({
    ok: true,
    newCampaignId,
    counts: {
      characters: charactersRows.length,
      monsters: monstersRows.length,
      cards: cardsRows.length,
      decks: decksRows.length,
      deck_cards: deckCardsRows.length,
      bestiary: bestiaryRows.length,
      restored_card_images: restoredImages,
    },
  });
}
