import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ABILITIES = ["physical", "mental", "magic", "intelligence", "diplomacy", "incivility"] as const;
type AbilityKey = (typeof ABILITIES)[number];

const SKILLS = [
  "acrobatics",
  "athletics",
  "communication",
  "deception",
  "history",
  "identification",
  "insight",
  "intimidation",
  "investigation",
  "learning",
  "perception",
  "performance",
  "persuasion",
  "sleight_of_hand",
  "spells",
] as const;
type SkillKey = (typeof SKILLS)[number];

type CharacterSheet = {
  level: number;
  proficiencyBonus: number;
  abilities: Record<AbilityKey, number>;
  savingThrowProficiencies: Record<AbilityKey, boolean>;
  skillProficiencies: Record<SkillKey, boolean>;
  derived: {
    hpCurrent: number;
    hpMaxOverride: number | null;
    acOverride: number | null;
    initiativeOverride: number | null;
    speedOverride: number | null;
    passivePerceptionOverride: number | null;
  };
};

function isNum(x: any) {
  return typeof x === "number" && Number.isFinite(x);
}
function isInt(x: any) {
  return isNum(x) && Number.isInteger(x);
}
function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isValidSheet(x: any): x is CharacterSheet {
  return (
    x &&
    isInt(x.level) &&
    isInt(x.proficiencyBonus) &&
    x.abilities &&
    ABILITIES.every((k) => isInt(x.abilities[k])) &&
    x.savingThrowProficiencies &&
    ABILITIES.every((k) => typeof x.savingThrowProficiencies[k] === "boolean") &&
    x.skillProficiencies &&
    SKILLS.every((k) => typeof x.skillProficiencies[k] === "boolean") &&
    x.derived &&
    isInt(x.derived.hpCurrent) &&
    (x.derived.hpMaxOverride === null || isInt(x.derived.hpMaxOverride)) &&
    (x.derived.acOverride === null || isInt(x.derived.acOverride)) &&
    (x.derived.initiativeOverride === null || isInt(x.derived.initiativeOverride)) &&
    (x.derived.speedOverride === null || isInt(x.derived.speedOverride)) &&
    (x.derived.passivePerceptionOverride === null || isInt(x.derived.passivePerceptionOverride))
  );
}

function clean(input: CharacterSheet): CharacterSheet {
  // Keep generous ranges so you don’t get blocked by “creative” characters
  const level = clampInt(input.level, 1, 99);
  const proficiencyBonus = clampInt(input.proficiencyBonus, -50, 50);

  const abilities: Record<AbilityKey, number> = {} as any;
  for (const k of ABILITIES) abilities[k] = clampInt(input.abilities[k], -50, 50);

  const savingThrowProficiencies: Record<AbilityKey, boolean> = {} as any;
  for (const k of ABILITIES) savingThrowProficiencies[k] = Boolean(input.savingThrowProficiencies[k]);

  const skillProficiencies: Record<SkillKey, boolean> = {} as any;
  for (const k of SKILLS) skillProficiencies[k] = Boolean(input.skillProficiencies[k]);

  const derived = {
    hpCurrent: clampInt(input.derived.hpCurrent, 0, 9999),
    hpMaxOverride: input.derived.hpMaxOverride === null ? null : clampInt(input.derived.hpMaxOverride, 0, 9999),
    acOverride: input.derived.acOverride === null ? null : clampInt(input.derived.acOverride, -50, 999),
    initiativeOverride: input.derived.initiativeOverride === null ? null : clampInt(input.derived.initiativeOverride, -50, 999),
    speedOverride: input.derived.speedOverride === null ? null : clampInt(input.derived.speedOverride, 0, 999),
    passivePerceptionOverride:
      input.derived.passivePerceptionOverride === null ? null : clampInt(input.derived.passivePerceptionOverride, -50, 999),
  };

  return {
    level,
    proficiencyBonus,
    abilities,
    savingThrowProficiencies,
    skillProficiencies,
    derived,
  };
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  const characterId = typeof body?.characterId === "string" ? body.characterId : "";
  const characterSheet = body?.characterSheet;

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!characterId) return NextResponse.json({ error: "Missing characterId" }, { status: 400 });
  if (!isValidSheet(characterSheet)) return NextResponse.json({ error: "Invalid characterSheet" }, { status: 400 });

  const cleaned = clean(characterSheet);

  // Preserve other keys in sheet (items, reportCard, isNpc, etc.)
  const { data: character, error: readErr } = await supabase
    .from("characters")
    .select("sheet")
    .eq("id", characterId)
    .eq("campaign_id", campaignId)
    .single();

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 400 });

  const sheet = (character?.sheet ?? {}) as any;
  const nextSheet = { ...sheet, characterSheet: cleaned };

  const { error: writeErr } = await supabase
    .from("characters")
    .update({ sheet: nextSheet })
    .eq("id", characterId)
    .eq("campaign_id", campaignId);

  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
