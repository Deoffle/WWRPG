import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Stats = { PHY: number; MEN: number; MAG: number; INT: number; DIP: number; ICY: number };

function asString(x: any, fallback = "") {
  return typeof x === "string" ? x : fallback;
}
function asStringArray(x: any): string[] {
  return Array.isArray(x) ? x.filter((v) => typeof v === "string") : [];
}
function toNum(x: any, fallback: number) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function asBlockArray(x: any) {
  if (!Array.isArray(x)) return [];
  return x
    .map((it: any) => ({
      name: typeof it?.name === "string" ? it.name : "",
      text: typeof it?.text === "string" ? it.text : "",
    }))
    .filter((b: any) => b.name.trim() || b.text.trim());
}

function normalizeCategory(x: any) {
  const raw = typeof x === "string" ? x.trim() : "";
  return raw || "Unsorted";
}

function revealForLevel(monster: any, level: number) {
  const data = monster?.data ?? {};
  const sheet = data?.sheet ?? {};

  const base = {
    monsterId: monster.id,
    name: monster.name,
    imageUrl: data.imageUrl ?? null,
    tags: Array.isArray(monster.tags) ? monster.tags : [],
  };

  if (level === 1) return base;

  if (level === 2) {
    return {
      ...base,
      type: asString(data.type),
      size: asString(data.size),
      strengths: asStringArray(data.strengths),
      weaknesses: asStringArray(data.weaknesses),
    };
  }

  // level 3
  const stats: Stats = {
    PHY: toNum(data?.stats?.PHY, 10),
    MEN: toNum(data?.stats?.MEN, 10),
    MAG: toNum(data?.stats?.MAG, 10),
    INT: toNum(data?.stats?.INT, 10),
    DIP: toNum(data?.stats?.DIP, 10),
    ICY: toNum(data?.stats?.ICY, 10),
  };

  return {
    ...base,
    sheet: {
      type: asString(data.type),
      size: asString(data.size),
      alignment: asString(data.alignment),
      ac: data.ac ?? null,
      hp: data.hp ?? null,
      speed: asString(data.speed),
      stats,

      strengths: asStringArray(data.strengths),
      weaknesses: asStringArray(data.weaknesses),

      senses: asString(data.senses),
      languages: asString(data.languages),

      description: asString(sheet.description, ""),
      resistances: asStringArray(sheet.resistances ?? data.resistances),
      immunities: asStringArray(sheet.immunities ?? data.immunities),

      traits: asBlockArray(sheet.traits),
      actions: asBlockArray(sheet.actions),
      reactions: asBlockArray(sheet.reactions),
      legendary_actions: asBlockArray(sheet.legendary_actions),
    },
  };
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: authRes } = await supabase.auth.getUser();
  if (!authRes.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  const monsterId = typeof body?.monsterId === "string" ? body.monsterId : "";

  const allCharacters = Boolean(body?.allCharacters);
  const skipNpc = Boolean(body?.skipNpc);

  const characterId = typeof body?.characterId === "string" ? body.characterId : "";
  const category = normalizeCategory(body?.category);
  const revealLevel = Number(body?.revealLevel);

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!monsterId) return NextResponse.json({ error: "Missing monsterId" }, { status: 400 });
  if (![1, 2, 3].includes(revealLevel)) {
    return NextResponse.json({ error: "revealLevel must be 1, 2, or 3" }, { status: 400 });
  }
  if (!allCharacters && !characterId) {
    return NextResponse.json(
      { error: "Missing characterId (or set allCharacters=true)" },
      { status: 400 }
    );
  }

  // Fetch monster (DM-only enforced by RLS on monsters)
  const { data: monster, error: monsterErr } = await supabase
    .from("monsters")
    .select("id,campaign_id,name,tags,data")
    .eq("id", monsterId)
    .eq("campaign_id", campaignId)
    .single();

  if (monsterErr || !monster) {
    return NextResponse.json(
      { error: monsterErr?.message ?? "Monster not found" },
      { status: 400 }
    );
  }

  // Determine target characters
  let targetCharacterIds: string[] = [];

  if (allCharacters) {
    const { data: characters, error: charactersErr } = await supabase
      .from("characters")
      .select("id,sheet")
      .eq("campaign_id", campaignId);

    if (charactersErr) return NextResponse.json({ error: charactersErr.message }, { status: 400 });

    targetCharacterIds = (characters ?? [])
      .filter((p: any) => {
        if (!skipNpc) return true;
        const isNpc = Boolean((p?.sheet ?? {})?.isNpc);
        return !isNpc;
      })
      .map((p: any) => p.id)
      .filter((id: any) => typeof id === "string" && id.length > 0);
  } else {
    targetCharacterIds = [characterId];
  }

  if (targetCharacterIds.length === 0) {
    return NextResponse.json(
      { error: "No target characters found (maybe all are NPCs?)" },
      { status: 400 }
    );
  }

  // Optional safety: avoid accidental huge writes
  // (keep or remove as you like)
  if (targetCharacterIds.length > 500) {
    return NextResponse.json(
      { error: "Too many target characters for one push." },
      { status: 400 }
    );
  }

  const revealed = revealForLevel(monster, revealLevel);

  // Upsert entries
  const rows = targetCharacterIds.map((pid) => ({
    campaign_id: campaignId,
    character_id: pid,
    monster_id: monsterId,
    category,
    reveal_level: revealLevel,
    revealed,
  }));

  const { error: upsertErr } = await supabase
    .from("bestiary_entries")
    .upsert(rows, { onConflict: "character_id,monster_id" });

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, count: rows.length });
}
