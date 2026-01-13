import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function asString(x: any) {
  return typeof x === "string" ? x : "";
}
function asInt(x: any, fallback = 0) {
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const campaignId = asString(body?.campaignId);
  const characterId = asString(body?.characterId);
  const cardId = asString(body?.cardId);

  const combatQty = asInt(body?.combatQty, 0);
  const explorationQty = asInt(body?.explorationQty, 0);

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!characterId) return NextResponse.json({ error: "Missing characterId" }, { status: 400 });
  if (!cardId) return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
  if (combatQty < 0 || explorationQty < 0) {
    return NextResponse.json({ error: "Quantities must be >= 0" }, { status: 400 });
  }

  // 1) Ensure BOTH decks exist (safe even if already created on character creation)
  const { data: decks, error: decksErr } = await supabase
    .from("decks")
    .upsert(
      [
        { campaign_id: campaignId, character_id: characterId, deck_type: "combat", name: "Combat deck" },
        { campaign_id: campaignId, character_id: characterId, deck_type: "exploration", name: "Exploration deck" },
      ],
      { onConflict: "campaign_id,character_id,deck_type" }
    )
    .select("id,deck_type");

  if (decksErr || !decks) {
    return NextResponse.json({ error: decksErr?.message ?? "Failed to ensure decks" }, { status: 400 });
  }

  const deckIdByType = new Map<string, string>();
  for (const d of decks as any[]) deckIdByType.set(d.deck_type, d.id);

  const combatDeckId = deckIdByType.get("combat");
  const explorationDeckId = deckIdByType.get("exploration");
  if (!combatDeckId || !explorationDeckId) {
    return NextResponse.json({ error: "Deck creation returned incomplete data" }, { status: 400 });
  }

  async function setDeckCard(deckId: string, qty: number) {
    if (qty === 0) {
      const { error } = await supabase.from("deck_cards").delete().eq("deck_id", deckId).eq("card_id", cardId);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("deck_cards").upsert(
      { deck_id: deckId, card_id: cardId, quantity: qty },
      { onConflict: "deck_id,card_id" }
    );
    if (error) throw error;
  }

  try {
    await setDeckCard(combatDeckId, combatQty);
    await setDeckCard(explorationDeckId, explorationQty);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to push card" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
