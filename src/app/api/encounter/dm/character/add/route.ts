import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function numOr0(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function abilityMod(score: number) {
  return Math.floor((Number(score) - 10) / 2);
}

function computeHpMaxFromSheet(sheet: any): number {
  const cs = sheet?.characterSheet ?? sheet?.charactersheet ?? {};

  const level = Number.isFinite(Number(cs?.level)) ? Number(cs.level) : 1;

  const abilities = cs?.abilities ?? {};
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
  const csRaw = sheet?.characterSheet ?? sheet?.charactersheet ?? {};

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

  return Math.max(1, Math.trunc(hpMax));
}


function readHpCurrentFromSheet(sheet: any): number | null {
  const cs = sheet?.characterSheet ?? sheet?.charactersheet ?? {};
  const hpObj = cs?.hp ?? cs?.HP ?? null;

  const candidates = [
    cs?.derived?.hpCurrent, // ✅ reference panel uses this as current
    hpObj?.current,
    cs?.hpCurrent,
    cs?.currentHp,
  ];

  for (const x of candidates) {
    const n = Number(x);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}



function clampHp(cur: number, max: number) {
  const maxSafe = Math.max(1, max);
  return Math.min(Math.max(0, cur), maxSafe);
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const body = await req.json().catch(() => ({}));
  const campaignId = String(body?.campaignId ?? "");
  const encounterId = String(body?.encounterId ?? "");
  const characterId = String(body?.characterId ?? "");

  if (!campaignId || !encounterId || !characterId) {
    return NextResponse.json(
      { error: "campaignId, encounterId, characterId are required" },
      { status: 400 }
    );
  }

  const { data: character, error: charErr } = await supabase
    .from("characters")
    .select("id, name, sheet")
    .eq("id", characterId)
    .eq("campaign_id", campaignId)
    .single();

  if (charErr) return NextResponse.json({ error: charErr.message }, { status: 400 });
  if (!character?.id) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const { data: existing, error: existingErr } = await supabase
    .from("encounter_combatants")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("encounter_id", encounterId)
    .eq("character_id", character.id)
    .maybeSingle();

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 400 });
  if (existing?.id) {
    return NextResponse.json({ ok: true, alreadyExists: true, combatantId: existing.id });
  }

  const sheet = (character?.sheet ?? {}) as any;
  const isNpc = sheet?.isNpc === true || sheet?.isNpc === "true";

  const maxFinal = computeHpMaxFromSheet(sheet);
  const curFromSheet = readHpCurrentFromSheet(sheet);

  const curBase = typeof curFromSheet === "number" ? curFromSheet : maxFinal;
  const curFinal = clampHp(curBase, maxFinal);

  console.log("[add character hp]", {
    isNpc,
    level: sheet?.characterSheet?.level,
    physical: sheet?.characterSheet?.abilities?.physical,
    curFromSheet,
    maxFinal,
    hp: sheet?.characterSheet?.hp,
    derived: sheet?.characterSheet?.derived,
  });



  const { data: combatant, error: combErr } = await supabase
    .from("encounter_combatants")
    .insert({
      campaign_id: campaignId,
      encounter_id: encounterId,
      kind: isNpc ? "npc" : "character",
      character_id: character.id,
      name: character.name,
      is_hidden: false,
      is_defeated: false,
      status_public: [],
      order_index: 0,

      hp_current: curFinal,
      hp_max: maxFinal,
      death_saves_successes: 0,
      death_saves_failures: 0,
    })
    .select("id")
    .single();

  if (combErr) return NextResponse.json({ error: combErr.message }, { status: 400 });

  const { error: privErr } = await supabase.from("encounter_combatants_private").insert({
    combatant_id: combatant.id,
    initiative: 0,
    hp_current: curFinal,
    hp_max: maxFinal,
    dm_notes: "",
  });

  if (privErr) return NextResponse.json({ error: privErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, combatantId: combatant.id });
}
