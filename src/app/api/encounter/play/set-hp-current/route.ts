import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function asString(x: any) {
  return typeof x === "string" ? x : "";
}
function asInt(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function numOr0(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function abilityMod(score: number) {
  return Math.floor((Number(score) - 10) / 2);
}

function computeHpMaxFromSheet(sheet: any): number {
  const csRaw = sheet?.characterSheet ?? sheet?.charactersheet ?? {};
  const level = Number.isFinite(Number(csRaw?.level)) ? Number(csRaw.level) : 1;

  const abilities = csRaw?.abilities ?? {};
  const basePhysical = Number.isFinite(Number(abilities?.physical)) ? Number(abilities.physical) : 10;

  const items = Array.isArray(sheet?.items) ? sheet.items : [];
  const equipped = items.filter((it: any) => it?.kind === "equipment" && it?.equipped && (it.qty ?? 0) > 0);

  let equipPhysicalBonus = 0;
  let equipHpMaxBonus = 0;

  for (const it of equipped) {
    equipPhysicalBonus += numOr0(it?.modifiers?.abilities?.physical);
    equipHpMaxBonus += numOr0(it?.modifiers?.derived?.hpMax);
  }

  const effectivePhysical = basePhysical + equipPhysicalBonus;
  const physMod = abilityMod(effectivePhysical);

  const defaultHpMax = 10 * (level + physMod);

  const hpMaxOverrideRaw = csRaw?.derived?.hpMaxOverride;

  // IMPORTANT: null should mean "no override" (not 0)
  const hpMaxOverride =
    hpMaxOverrideRaw === null || hpMaxOverrideRaw === undefined || hpMaxOverrideRaw === ""
      ? null
      : (() => {
          const n = Number(hpMaxOverrideRaw);
          return Number.isFinite(n) ? n : null;
        })();

  const hpMaxBase = hpMaxOverride ?? defaultHpMax;

  const hpMax = hpMaxBase + equipHpMaxBonus;

  // keep sane
  return Math.max(1, Math.trunc(hpMax));
}

function readHpCurrentFromSheet(sheet: any): number | null {
  const csRaw = sheet?.characterSheet ?? sheet?.charactersheet ?? {};
  const hpObj = csRaw?.hp ?? csRaw?.HP ?? null;

  const candidates = [
    hpObj?.current,
    csRaw?.hpCurrent,
    csRaw?.currentHp,
    csRaw?.derived?.hpCurrent,
  ];

  for (const x of candidates) {
    const n = Number(x);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}



/**
 * Write CURRENT HP only.
 * Do NOT touch cs.derived.hpCurrent (because it behaves like MAX in your data).
 */
function writeHpToSheet(sheet: any, cur: number) {
  const out = sheet && typeof sheet === "object" ? { ...sheet } : {};
  const cs = out.characterSheet && typeof out.characterSheet === "object" ? { ...out.characterSheet } : {};
  const hp = cs.hp && typeof cs.hp === "object" ? { ...cs.hp } : {};
  const derived = cs.derived && typeof cs.derived === "object" ? { ...cs.derived } : {};

  // ✅ current
  hp.current = cur;
  cs.hp = hp;

  cs.hpCurrent = cur;
  cs.currentHp = cur;

  derived.hpCurrent = cur; // ✅ this is what your sheet editor uses as "current"
  cs.derived = derived;

  // ❌ do NOT touch hp.max here
  out.characterSheet = cs;
  return out;
}


export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = asString(body?.campaignId);
  const encounterId = asString(body?.encounterId);
  const characterId = asString(body?.characterId);
  const hpCurrent = asInt(body?.hpCurrent, -1);

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!encounterId) return NextResponse.json({ error: "Missing encounterId" }, { status: 400 });
  if (!characterId) return NextResponse.json({ error: "Missing characterId" }, { status: 400 });
  if (hpCurrent < 0) return NextResponse.json({ error: "Invalid hpCurrent" }, { status: 400 });

  // Verify player owns the character
  const { data: ch, error: chErr } = await supabase
    .from("characters")
    .select("id,user_id,sheet")
    .eq("id", characterId)
    .eq("campaign_id", campaignId)
    .single();

  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 400 });
  if (ch.user_id !== userData.user.id) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const sheet = (ch.sheet ?? {}) as any;
  const maxSafe = computeHpMaxFromSheet(sheet);
  const clampedCur = Math.min(Math.max(0, hpCurrent), maxSafe);

  // Update character sheet (CURRENT only)
  const newSheet = writeHpToSheet(sheet, clampedCur);

  const { error: upChErr } = await supabase
    .from("characters")
    .update({ sheet: newSheet })
    .eq("id", characterId)
    .eq("campaign_id", campaignId);

  if (upChErr) return NextResponse.json({ error: upChErr.message }, { status: 400 });

  // ✅ Sync PUBLIC combat HP (this is what the play screen reads)

  // First: do we even HAVE a combatant row in this encounter?
  const { data: combRow, error: combFindErr } = await supabase
    .from("encounter_combatants")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("encounter_id", encounterId)
    .eq("kind", "character")
    .eq("character_id", characterId)
    .maybeSingle();

  if (combFindErr) return NextResponse.json({ error: combFindErr.message }, { status: 400 });

  // If not found, then the client sent the wrong encounterId (or character isn't added)
  if (!combRow?.id) {
    return NextResponse.json(
      { error: "combatant_not_found_in_encounter (HP saved to sheet, but not synced to encounter)" },
      { status: 409 }
    );
  }

  // Now update by *id* (simpler + avoids mismatches)
  const { data: updatedComb, error: upCombErr } = await supabase
    .from("encounter_combatants")
    .update({ hp_current: clampedCur, hp_max: maxSafe })
    .eq("id", combRow.id)
    .select("id,hp_current,hp_max")
    .maybeSingle();

  if (upCombErr) return NextResponse.json({ error: upCombErr.message }, { status: 400 });

  // If we found the row but still couldn't update it => that's almost certainly RLS blocking UPDATE
  if (!updatedComb?.id) {
    return NextResponse.json(
      { error: "combatant_update_blocked (likely RLS: select allowed, update blocked)" },
      { status: 403 }
    );
  }

  // Optional DM-private sync (ignore errors)
  try {
    await supabase
      .from("encounter_combatants_private")
      .update({ hp_current: clampedCur, hp_max: maxSafe })
      .eq("combatant_id", updatedComb.id);
  } catch {}

  return NextResponse.json({ ok: true, hpCurrent: updatedComb.hp_current, hpMax: updatedComb.hp_max });
}
