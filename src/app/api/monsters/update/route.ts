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

// Must match /api/bestiary/push reveal schema (L1/L2/L3)
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
  const monsterId = typeof body?.monsterId === "string" ? body.monsterId : "";
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  const patch = body?.patch;

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!monsterId) return NextResponse.json({ error: "Missing monsterId" }, { status: 400 });
  if (!patch || typeof patch !== "object") {
    return NextResponse.json({ error: "Missing patch" }, { status: 400 });
  }

  // Update monster (DM-only enforced by RLS)
  const { error: updateErr } = await supabase
    .from("monsters")
    .update(patch)
    .eq("id", monsterId)
    .eq("campaign_id", campaignId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

  // Re-fetch updated monster row (needed for up-to-date bestiary snapshots)
  const { data: monster, error: monsterErr } = await supabase
    .from("monsters")
    .select("id,campaign_id,name,tags,data")
    .eq("id", monsterId)
    .eq("campaign_id", campaignId)
    .single();

  if (monsterErr || !monster) {
    // Monster update succeeded, but we couldn't re-read it. Return ok, but note it.
    return NextResponse.json({
      ok: true,
      warning: monsterErr?.message ?? "Updated monster, but could not re-load for bestiary refresh.",
    });
  }

  // Refresh existing bestiary snapshots for this monster
  // (So characters keep their reveal level, but content stays in sync with the monster.)
  const { data: entries, error: entErr } = await supabase
    .from("bestiary_entries")
    .select("character_id,reveal_level,category")
    .eq("campaign_id", campaignId)
    .eq("monster_id", monsterId);

  if (entErr) {
    // Monster update succeeded; bestiary refresh failed (non-fatal)
    return NextResponse.json({ ok: true, warning: entErr.message });
  }

  if (entries && entries.length > 0) {
    const rows = entries
      .map((e: any) => {
        const lvl = Number(e?.reveal_level);
        if (![1, 2, 3].includes(lvl)) return null;

        return {
          campaign_id: campaignId,
          character_id: e.character_id,
          monster_id: monsterId,
          category: typeof e.category === "string" && e.category.trim() ? e.category.trim() : "Unsorted",
          reveal_level: lvl,
          revealed: revealForLevel(monster, lvl),
        };
      })
      .filter(Boolean) as any[];

    if (rows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("bestiary_entries")
        .upsert(rows, { onConflict: "character_id,monster_id" });

      if (upsertErr) {
        // Monster update succeeded; bestiary refresh failed (non-fatal)
        return NextResponse.json({ ok: true, warning: upsertErr.message });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
