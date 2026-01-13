"use client";

import { useMemo } from "react";

const ABILITIES = ["physical", "mental", "magic", "intelligence", "diplomacy", "incivility"] as const;
type AbilityKey = (typeof ABILITIES)[number];

const SKILLS = [
  { key: "acrobatics", label: "Acrobatics", ability: "physical" },
  { key: "athletics", label: "Athletics", ability: "physical" },
  { key: "communication", label: "Communication", ability: "diplomacy" },
  { key: "deception", label: "Deception", ability: "incivility" },
  { key: "history", label: "History", ability: "intelligence" },
  { key: "identification", label: "Identification", ability: "magic" },
  { key: "insight", label: "Insight", ability: "diplomacy" },
  { key: "intimidation", label: "Intimidation", ability: "incivility" },
  { key: "investigation", label: "Investigation", ability: "intelligence" },
  { key: "learning", label: "Learning", ability: "mental" as const },
  { key: "perception", label: "Perception", ability: "mental" },
  { key: "performance", label: "Performance", ability: "incivility" },
  { key: "persuasion", label: "Persuasion", ability: "diplomacy" },
  { key: "sleight_of_hand", label: "Sleight of Hand", ability: "physical" },
  { key: "spells", label: "Spells", ability: "magic" },
] as const;
type SkillKey = (typeof SKILLS)[number]["key"];

const SUBJECTS = [
  { key: "astronomy", label: "Astronomy" },
  { key: "care_of_magical_creatures", label: "Care of Magical Creatures" },
  { key: "charms", label: "Charms" },
  { key: "defense_against_the_dark_arts", label: "Defense Against the Dark Arts" },
  { key: "herbology", label: "Herbology" },
  { key: "potions", label: "Potions" },
  { key: "transfiguration", label: "Transfiguration" },
] as const;

const GRADES = ["F", "E", "D", "C", "B", "A"] as const;
type Grade = (typeof GRADES)[number];

function abilityMod(score: number) {
  return Math.floor((Number(score) - 10) / 2);
}
function fmtSigned(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}
function numOr0(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function sumRecord<K extends string>(rows: Array<Partial<Record<K, number>> | undefined>, keys: readonly K[]) {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const r of rows) {
    if (!r) continue;
    for (const k of keys) out[k] += numOr0((r as any)[k]);
  }
  return out;
}
function clampIndex(i: number) {
  return Math.max(0, Math.min(GRADES.length - 1, i));
}
function effectiveGrade(base: Grade, proficient: boolean, proficiencyBonus: number): Grade {
  const baseIdx = GRADES.indexOf(base);
  const steps = proficient ? Math.floor((Number(proficiencyBonus) || 0) / 2) : 0;
  return GRADES[clampIndex(baseIdx + steps)];
}

function makeDefaultReportCard() {
  return {
    subjects: SUBJECTS.map((s) => ({ key: s.key, grade: "F" as Grade, proficient: false })),
    notes: "",
  };
}
function normalizeReportCard(input: any) {
  const def = makeDefaultReportCard();
  const byKey = new Map<string, any>();

  if (input && Array.isArray(input.subjects)) {
    for (const s of input.subjects) if (s && typeof s.key === "string") byKey.set(s.key, s);
  }

  return {
    subjects: SUBJECTS.map((subj) => {
      const found = byKey.get(subj.key);
      const grade: Grade = (typeof found?.grade === "string" && (GRADES as readonly string[]).includes(found.grade))
        ? found.grade
        : "F";
      return { key: subj.key, grade, proficient: Boolean(found?.proficient) };
    }),
    notes: typeof input?.notes === "string" ? input.notes : def.notes,
  };
}

function makeDefaultSheet() {
  return {
    level: 1,
    proficiencyBonus: 0,
    abilities: {
      physical: 10,
      mental: 10,
      magic: 10,
      intelligence: 10,
      diplomacy: 10,
      incivility: 10,
    } as Record<AbilityKey, number>,
    savingThrowProficiencies: Object.fromEntries(ABILITIES.map((k) => [k, false])) as Record<AbilityKey, boolean>,
    skillProficiencies: Object.fromEntries(SKILLS.map((s) => [s.key, false])) as Record<SkillKey, boolean>,
    reportCard: makeDefaultReportCard(),
    derived: {
      hpCurrent: 10,
      hpMaxOverride: null as number | null,
      acOverride: null as number | null,
      initiativeOverride: null as number | null,
      speedOverride: null as number | null,
      passivePerceptionOverride: null as number | null,
    },
  };
}

function normalizeSheet(input: any, legacyReportCard: any) {
  const def = makeDefaultSheet();
  const out = JSON.parse(JSON.stringify(def));

  if (input && typeof input === "object") {
    if (Number.isInteger(input.level)) out.level = input.level;
    if (Number.isInteger(input.proficiencyBonus)) out.proficiencyBonus = input.proficiencyBonus;

    if (input.abilities && typeof input.abilities === "object") {
      for (const k of ABILITIES) if (Number.isInteger(input.abilities[k])) out.abilities[k] = input.abilities[k];
    }
    if (input.savingThrowProficiencies && typeof input.savingThrowProficiencies === "object") {
      for (const k of ABILITIES) out.savingThrowProficiencies[k] = Boolean(input.savingThrowProficiencies[k]);
    }
    if (input.skillProficiencies && typeof input.skillProficiencies === "object") {
      for (const s of SKILLS) out.skillProficiencies[s.key] = Boolean(input.skillProficiencies[s.key]);
    }
    if (input.derived && typeof input.derived === "object") {
      const d = input.derived;
      if (Number.isInteger(d.hpCurrent)) out.derived.hpCurrent = d.hpCurrent;
      out.derived.hpMaxOverride = Number.isInteger(d.hpMaxOverride) ? d.hpMaxOverride : null;
      out.derived.acOverride = Number.isInteger(d.acOverride) ? d.acOverride : null;
      out.derived.initiativeOverride = Number.isInteger(d.initiativeOverride) ? d.initiativeOverride : null;
      out.derived.speedOverride = Number.isInteger(d.speedOverride) ? d.speedOverride : null;
      out.derived.passivePerceptionOverride = Number.isInteger(d.passivePerceptionOverride) ? d.passivePerceptionOverride : null;
    }
    if (input.reportCard) out.reportCard = normalizeReportCard(input.reportCard);
  }

  if (!input?.reportCard && legacyReportCard) out.reportCard = normalizeReportCard(legacyReportCard);

  return out as ReturnType<typeof makeDefaultSheet>;
}

type ItemV2 = {
  id: string;
  kind: "equipment" | "consumable" | "key" | "other";
  name: string;
  qty: number;
  equipped?: boolean;
  modifiers?: {
    abilities?: Partial<Record<AbilityKey, number>>;
    saves?: Partial<Record<AbilityKey, number>>;
    skills?: Partial<Record<SkillKey, number>>;
    derived?: Partial<{
      hpMax: number;
      ac: number;
      initiative: number;
      speed: number;
      passivePerception: number;
    }>;
  };
};

export default function CharacterSheetReference({
  characterName,
  sheetRaw,
  legacyReportCard,
  itemsRaw,
}: {
  characterName: string;
  sheetRaw: any;
  legacyReportCard: any;
  itemsRaw: any;
}) {
  const cs = useMemo(() => normalizeSheet(sheetRaw, legacyReportCard), [sheetRaw, legacyReportCard]);

  const items: ItemV2[] = Array.isArray(itemsRaw) ? (itemsRaw as any) : [];

  const equipped = useMemo(
    () => items.filter((it) => it?.kind === "equipment" && it?.equipped && (it.qty ?? 0) > 0),
    [items]
  );

  const equipAbilityBonus = useMemo(
    () => sumRecord<AbilityKey>(equipped.map((e) => e.modifiers?.abilities), ABILITIES),
    [equipped]
  );
  const equipSaveBonus = useMemo(
    () => sumRecord<AbilityKey>(equipped.map((e) => e.modifiers?.saves), ABILITIES),
    [equipped]
  );
  const equipSkillBonus = useMemo(() => {
    const keys = SKILLS.map((s) => s.key) as readonly SkillKey[];
    return sumRecord<SkillKey>(equipped.map((e) => e.modifiers?.skills), keys);
  }, [equipped]);

  const equipDerivedBonus = useMemo(() => {
    const out = { hpMax: 0, ac: 0, initiative: 0, speed: 0, passivePerception: 0 };
    for (const e of equipped) {
      const d = e.modifiers?.derived;
      if (!d) continue;
      out.hpMax += numOr0(d.hpMax);
      out.ac += numOr0(d.ac);
      out.initiative += numOr0(d.initiative);
      out.speed += numOr0(d.speed);
      out.passivePerception += numOr0(d.passivePerception);
    }
    return out;
  }, [equipped]);

  const effectiveScores = useMemo(() => {
    const out = {} as Record<AbilityKey, number>;
    for (const k of ABILITIES) out[k] = (cs.abilities[k] ?? 0) + (equipAbilityBonus[k] ?? 0);
    return out;
  }, [cs.abilities, equipAbilityBonus]);

  const mods = useMemo(() => {
    const out = {} as Record<AbilityKey, number>;
    for (const k of ABILITIES) out[k] = abilityMod(effectiveScores[k]);
    return out;
  }, [effectiveScores]);

  const learningBaseAbility: AbilityKey = mods.intelligence > mods.mental ? "intelligence" : "mental";

  function saveTotalForAbility(ability: AbilityKey, proficient: boolean) {
    return mods[ability] + (proficient ? cs.proficiencyBonus : 0) + (equipSaveBonus[ability] ?? 0);
  }

  function skillBaseAbility(key: SkillKey): AbilityKey {
    if (key === "learning") return learningBaseAbility;
    return (SKILLS.find((s) => s.key === key)!.ability as AbilityKey);
  }

  function skillTotal(key: SkillKey) {
    const base = skillBaseAbility(key);
    return mods[base] + (cs.skillProficiencies[key] ? cs.proficiencyBonus : 0) + (equipSkillBonus[key] ?? 0);
  }

  const defaultHpMax = useMemo(() => 10 * (cs.level + mods.physical), [cs.level, mods.physical]);
  const hpMaxBase = cs.derived.hpMaxOverride ?? defaultHpMax;
  const hpMax = hpMaxBase + equipDerivedBonus.hpMax;

  const acBase = cs.derived.acOverride ?? 10;
  const ac = acBase + equipDerivedBonus.ac;

  const initiativeBase = cs.derived.initiativeOverride ?? mods.mental;
  const initiative = initiativeBase + equipDerivedBonus.initiative;

  const speedBase = cs.derived.speedOverride ?? 8;
  const speed = speedBase + equipDerivedBonus.speed;

  const passiveBase = cs.derived.passivePerceptionOverride ?? (10 + mods.mental);
  const passivePerception = passiveBase + equipDerivedBonus.passivePerception;

  const reportSteps = Math.floor((Number(cs.proficiencyBonus) || 0) / 2);

  return (
    <div className="space-y-4 text-sm">
      <div className="text-xs text-gray-600">
        <span className="font-medium text-gray-800">{characterName}</span> · Equipped modifiers active:{" "}
        <span className="font-medium">{equipped.length}</span>
      </div>

      <section className="border rounded-xl p-3 space-y-2">
        <div className="font-medium">Derived</div>
        <div className="grid gap-2 grid-cols-2">
          <Stat label="HP" value={`${cs.derived.hpCurrent} / ${hpMax}`} />
          <Stat label="AC" value={String(ac)} />
          <Stat label="Initiative" value={fmtSigned(initiative)} />
          <Stat label="Speed" value={String(speed)} />
          <Stat label="Passive Perception" value={String(passivePerception)} />
        </div>
      </section>

      <section className="border rounded-xl p-3 space-y-2">
        <div className="font-medium">Abilities</div>
        <div className="grid gap-2 grid-cols-2">
          {ABILITIES.map((k) => (
            <div key={k} className="border rounded-lg p-2">
              <div className="text-xs text-gray-600 capitalize">{k}</div>
              <div className="font-medium">
                {effectiveScores[k]}{" "}
                <span className="text-xs text-gray-500">({fmtSigned(mods[k])})</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border rounded-xl p-3 space-y-2">
        <div className="font-medium">Saving throws</div>
        <div className="grid gap-2 grid-cols-2">
          {ABILITIES.map((k) => (
            <div key={k} className="border rounded-lg p-2 flex items-center justify-between gap-2">
              <div className="capitalize">{k}</div>
              <div className="font-semibold">{fmtSigned(saveTotalForAbility(k, cs.savingThrowProficiencies[k]))}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border rounded-xl p-3 space-y-2">
        <div className="font-medium">Skills</div>
        <div className="space-y-1">
          {SKILLS.map((s) => (
            <div key={s.key} className="border rounded-lg px-2 py-1 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{s.label}</div>
                <div className="text-[11px] text-gray-500">
                  base: <span className="capitalize">{skillBaseAbility(s.key)}</span>
                  {s.key === "learning" ? " (higher of Men/Int)" : ""}
                </div>
              </div>
              <div className="font-semibold">{fmtSigned(skillTotal(s.key))}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border rounded-xl p-3 space-y-2">
        <div className="font-medium">Knowledge (Report card)</div>
        <div className="text-xs text-gray-600">
          Proficient increases effective grade by <span className="font-medium">{reportSteps}</span> (cap A)
        </div>
        <div className="space-y-1">
          {SUBJECTS.map((subj) => {
            const row =
              cs.reportCard.subjects.find((x) => x.key === subj.key) ??
              ({ key: subj.key, grade: "F" as Grade, proficient: false } as any);

            const eff = effectiveGrade(row.grade, row.proficient, cs.proficiencyBonus);

            return (
              <div key={subj.key} className="border rounded-lg px-2 py-1 flex items-center justify-between gap-2">
                <div className="font-medium">{subj.label}</div>
                <div className="text-xs text-gray-600">
                  {row.grade} {row.proficient ? "→" : " "} <span className="font-semibold">{eff}</span>
                </div>
              </div>
            );
          })}
        </div>

        {cs.reportCard.notes?.trim() ? (
          <div className="border rounded-lg p-2 text-xs text-gray-700 whitespace-pre-wrap">
            {cs.reportCard.notes}
          </div>
        ) : (
          <div className="text-xs text-gray-500">No report card notes.</div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-2">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
