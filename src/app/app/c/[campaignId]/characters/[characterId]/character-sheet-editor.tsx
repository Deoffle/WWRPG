"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  { key: "learning", label: "Learning", ability: "mental" as const }, // special (max Men/Int)
  { key: "perception", label: "Perception", ability: "mental" },
  { key: "performance", label: "Performance", ability: "incivility" },
  { key: "persuasion", label: "Persuasion", ability: "diplomacy" },
  { key: "sleight_of_hand", label: "Sleight of Hand", ability: "physical" },
  { key: "spells", label: "Spells", ability: "magic" },
] as const;

type SkillKey = (typeof SKILLS)[number]["key"];

/** Report card (Knowledge) */
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
type SubjectKey = (typeof SUBJECTS)[number]["key"];

type ReportSubject = {
  key: SubjectKey;
  grade: Grade;
  proficient: boolean; // + floor(PB/2) steps
};

type ReportCard = {
  subjects: ReportSubject[];
  notes?: string;
};

type ItemKind = "equipment" | "consumable" | "key" | "other";
type EquipSlot =
  | "main_hand"
  | "offhand"
  | "head"
  | "body"
  | "hands"
  | "legs"
  | "feet"
  | "accessory";

type ItemV2 = {
  id: string;
  kind: ItemKind;
  name: string;
  qty: number;
  description?: string;

  slot?: EquipSlot;
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

type CharacterSheet = {
  level: number;
  proficiencyBonus: number;

  // Ability SCORES
  abilities: Record<AbilityKey, number>;

  savingThrowProficiencies: Record<AbilityKey, boolean>;
  skillProficiencies: Record<SkillKey, boolean>;

  reportCard: ReportCard;

  derived: {
    hpCurrent: number;
    hpMaxOverride: number | null;
    acOverride: number | null;
    initiativeOverride: number | null;
    speedOverride: number | null;
    passivePerceptionOverride: number | null;
  };
};

function toInt(s: string, fallback = 0) {
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function abilityMod(score: number) {
  return Math.floor((Number(score) - 10) / 2);
}

function fmtSigned(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function isGrade(x: unknown): x is Grade {
  return typeof x === "string" && (GRADES as readonly string[]).includes(x);
}

function makeDefaultReportCard(): ReportCard {
  return {
    subjects: SUBJECTS.map((s) => ({ key: s.key, grade: "F" as Grade, proficient: false })),
    notes: "",
  };
}

function normalizeReportCard(input: any): ReportCard {
  const def = makeDefaultReportCard();
  const byKey = new Map<SubjectKey, any>();

  if (input && Array.isArray(input.subjects)) {
    for (const s of input.subjects) {
      if (s && typeof s.key === "string") byKey.set(s.key as SubjectKey, s);
    }
  }

  const subjects: ReportSubject[] = SUBJECTS.map((subj) => {
    const found = byKey.get(subj.key);
    const grade: Grade = isGrade(found?.grade) ? found.grade : "F";
    const proficient = Boolean(found?.proficient);
    return { key: subj.key, grade, proficient };
  });

  return {
    subjects,
    notes: typeof input?.notes === "string" ? input.notes : def.notes,
  };
}

function clampIndex(i: number) {
  return Math.max(0, Math.min(GRADES.length - 1, i));
}

function effectiveGrade(base: Grade, proficient: boolean, proficiencyBonus: number): Grade {
  const baseIdx = GRADES.indexOf(base);
  const steps = proficient ? Math.floor((Number(proficiencyBonus) || 0) / 2) : 0;
  return GRADES[clampIndex(baseIdx + steps)];
}

function makeDefault(): CharacterSheet {
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
    },
    savingThrowProficiencies: {
      physical: false,
      mental: false,
      magic: false,
      intelligence: false,
      diplomacy: false,
      incivility: false,
    },
    skillProficiencies: {
      acrobatics: false,
      athletics: false,
      communication: false,
      deception: false,
      history: false,
      identification: false,
      insight: false,
      intimidation: false,
      investigation: false,
      learning: false,
      perception: false,
      performance: false,
      persuasion: false,
      sleight_of_hand: false,
      spells: false,
    },
    reportCard: makeDefaultReportCard(),
    derived: {
      hpCurrent: 10,
      hpMaxOverride: null,
      acOverride: null,
      initiativeOverride: null,
      speedOverride: null,
      passivePerceptionOverride: null,
    },
  };
}

function normalize(input: any, legacyReportCard: any): CharacterSheet {
  const def = makeDefault();
  const out: CharacterSheet = JSON.parse(JSON.stringify(def));

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

  // Legacy fallback (remove later if you want)
  if (!input?.reportCard && legacyReportCard) out.reportCard = normalizeReportCard(legacyReportCard);

  return out;
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

export default function CharacterSheetEditor({
  campaignId,
  characterId,
  initialCharacterSheet,
  initialReportCard,
  initialItems,
}: {
  campaignId: string;
  characterId: string;
  initialCharacterSheet: any;
  initialReportCard: any;
  initialItems: any;
}) {
  const router = useRouter();
  const [cs, setCs] = useState<CharacterSheet>(() => normalize(initialCharacterSheet, initialReportCard));

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const items: ItemV2[] = Array.isArray(initialItems) ? (initialItems as any) : [];

  const equipped = useMemo(() => {
    return items.filter((it) => it?.kind === "equipment" && it?.equipped && (it.qty ?? 0) > 0);
  }, [items]);

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

  // Effective ability scores (base + equipment)
  const effectiveScores = useMemo(() => {
    const out = {} as Record<AbilityKey, number>;
    for (const k of ABILITIES) out[k] = (cs.abilities[k] ?? 0) + (equipAbilityBonus[k] ?? 0);
    return out;
  }, [cs.abilities, equipAbilityBonus]);

  // Effective mods from effective scores
  const mods = useMemo(() => {
    const out = {} as Record<AbilityKey, number>;
    for (const k of ABILITIES) out[k] = abilityMod(effectiveScores[k]);
    return out;
  }, [effectiveScores]);

  // Learning uses the higher effective modifier of Men/Int
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

  // Derived (base (override??default) + equipment derived bonus)
  const defaultHpMax = useMemo(() => 10 * (cs.level + mods.physical), [cs.level, mods.physical]);
  const hpMaxBase = cs.derived.hpMaxOverride ?? defaultHpMax;
  const hpMax = hpMaxBase + equipDerivedBonus.hpMax;

  const defaultAc = 10;
  const acBase = cs.derived.acOverride ?? defaultAc;
  const ac = acBase + equipDerivedBonus.ac;

  const defaultInitiative = mods.mental;
  const initiativeBase = cs.derived.initiativeOverride ?? defaultInitiative;
  const initiative = initiativeBase + equipDerivedBonus.initiative;

  const defaultSpeed = 8;
  const speedBase = cs.derived.speedOverride ?? defaultSpeed;
  const speed = speedBase + equipDerivedBonus.speed;

  const defaultPassivePerception = 10 + mods.mental;
  const passivePerceptionBase = cs.derived.passivePerceptionOverride ?? defaultPassivePerception;
  const passivePerception = passivePerceptionBase + equipDerivedBonus.passivePerception;

  const reportCardProfSteps = Math.floor((Number(cs.proficiencyBonus) || 0) / 2);

  async function save() {
    setErr(null);
    setBusy(true);

    const res = await fetch("/api/characters/character-sheet/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, characterId, characterSheet: cs }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to save character sheet.");
      return false;
    }

    router.refresh();
    return true;
  }

  return (
    <div className="space-y-6">
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <section className="border rounded-xl p-4 space-y-3">
        <h3 className="font-medium">Identity</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <div className="text-xs text-gray-600">Level</div>
            <input
              className="border rounded-md p-2 w-full"
              value={String(cs.level)}
              inputMode="numeric"
              onChange={(e) => setCs((p) => ({ ...p, level: toInt(e.target.value, p.level) }))}
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-gray-600">Proficiency bonus</div>
            <input
              className="border rounded-md p-2 w-full"
              value={String(cs.proficiencyBonus)}
              inputMode="numeric"
              onChange={(e) => setCs((p) => ({ ...p, proficiencyBonus: toInt(e.target.value, p.proficiencyBonus) }))}
            />
            <div className="text-xs text-gray-500">
              Report card proficiency steps: <span className="font-medium">{reportCardProfSteps}</span>
            </div>
          </label>
        </div>

        {equipped.length ? (
          <div className="text-xs text-gray-600">
            Equipped items affecting stats: <span className="font-medium">{equipped.length}</span>
          </div>
        ) : (
          <div className="text-xs text-gray-500">No equipped equipment modifiers active.</div>
        )}
      </section>

      {/* Core stats */}
      <section className="border rounded-xl p-4 space-y-3">
        <h3 className="font-medium">Core stats</h3>

        <div className="text-xs text-gray-600">
          Enter the <span className="font-medium">base score</span>. Equipment modifiers change the effective score/modifier.
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ABILITIES.map((k) => {
            const base = cs.abilities[k] ?? 0;
            const bonus = equipAbilityBonus[k] ?? 0;
            const eff = effectiveScores[k] ?? 0;

            return (
              <div key={k} className="border rounded-lg p-3 space-y-2">
                <div className="font-medium capitalize">{k}</div>

                <label className="space-y-1 block">
                  <div className="text-xs text-gray-600">Base score</div>
                  <input
                    className="border rounded-md p-2 w-full"
                    value={String(base)}
                    inputMode="numeric"
                    onChange={(e) =>
                      setCs((p) => ({
                        ...p,
                        abilities: { ...p.abilities, [k]: toInt(e.target.value, p.abilities[k]) },
                      }))
                    }
                  />
                </label>

                <div className="text-sm text-gray-700">
                  Effective score:{" "}
                  <span className="font-semibold">
                    {eff}
                  </span>
                  {bonus !== 0 ? (
                    <span className="text-xs text-gray-500"> (equipment {fmtSigned(bonus)})</span>
                  ) : null}
                </div>

                <div className="text-sm text-gray-700">
                  Modifier: <span className="font-semibold">{fmtSigned(mods[k])}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Saving throws */}
      <section className="border rounded-xl p-4 space-y-3">
        <h3 className="font-medium">Saving throws</h3>

        <div className="text-xs text-gray-600">
          Total = ability mod + (proficiency if proficient) + equipment save bonuses.
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ABILITIES.map((k) => (
            <div key={k} className="border rounded-lg p-3 space-y-2">
              <div className="font-medium capitalize">{k}</div>

              <div className="text-sm text-gray-700">
                Base mod: <span className="font-medium">{fmtSigned(mods[k])}</span>
              </div>

              {equipSaveBonus[k] ? (
                <div className="text-xs text-gray-500">Equip bonus: {fmtSigned(equipSaveBonus[k])}</div>
              ) : null}

              <label className="flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  checked={cs.savingThrowProficiencies[k]}
                  onChange={(e) =>
                    setCs((p) => ({
                      ...p,
                      savingThrowProficiencies: { ...p.savingThrowProficiencies, [k]: e.target.checked },
                    }))
                  }
                />
                <span className="text-sm">Proficient</span>
              </label>

              <div className="text-sm text-gray-700">
                Total:{" "}
                <span className="font-semibold">
                  {fmtSigned(saveTotalForAbility(k, cs.savingThrowProficiencies[k]))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Skills */}
      <section className="border rounded-xl p-4 space-y-3">
        <h3 className="font-medium">Skills</h3>

        <div className="text-xs text-gray-600">
          Total = base ability mod + (proficiency if proficient) + equipment skill bonuses.
          Learning uses higher of Mental/Intelligence.
        </div>

        <div className="border rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 p-3 text-xs text-gray-600 border-b">
            <div className="col-span-5 font-medium">Skill</div>
            <div className="col-span-3 font-medium">Base stat</div>
            <div className="col-span-2 font-medium">Proficient</div>
            <div className="col-span-2 font-medium">Total</div>
          </div>

          {SKILLS.map((s) => {
            const baseAbility = skillBaseAbility(s.key);
            const total = skillTotal(s.key);
            const equipBonus = equipSkillBonus[s.key] ?? 0;

            return (
              <div key={s.key} className="grid grid-cols-12 gap-2 p-3 border-b last:border-b-0 items-center">
                <div className="col-span-5 font-medium">{s.label}</div>

                <div className="col-span-3">
                  {s.key === "learning" ? (
                    <div className="text-sm text-gray-700">
                      <span className="capitalize font-medium">{baseAbility}</span>{" "}
                      <span className="text-xs text-gray-500">(higher mod of Mental/Int)</span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-700 capitalize">{baseAbility}</div>
                  )}
                  <div className="text-xs text-gray-500">Base mod: {fmtSigned(mods[baseAbility])}</div>
                  {equipBonus !== 0 ? (
                    <div className="text-xs text-gray-500">Equip bonus: {fmtSigned(equipBonus)}</div>
                  ) : null}
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cs.skillProficiencies[s.key]}
                    onChange={(e) =>
                      setCs((p) => ({
                        ...p,
                        skillProficiencies: { ...p.skillProficiencies, [s.key]: e.target.checked },
                      }))
                    }
                  />
                  <span className="text-sm">Yes</span>
                </div>

                <div className="col-span-2 font-semibold">{fmtSigned(total)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Knowledge (Report card) */}
      <section className="border rounded-xl p-4 space-y-3">
        <div>
          <h3 className="font-medium">Knowledge (Report card)</h3>
          <div className="text-xs text-gray-600">
            If proficient: effective grade increases by <span className="font-medium">{reportCardProfSteps}</span> (capped at A).
          </div>
        </div>

        <div className="border rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 p-3 text-xs text-gray-600 border-b">
            <div className="col-span-5 font-medium">Class</div>
            <div className="col-span-3 font-medium">Base grade</div>
            <div className="col-span-2 font-medium">Proficient</div>
            <div className="col-span-2 font-medium">Effective</div>
          </div>

          {SUBJECTS.map((subj) => {
            const row =
              cs.reportCard.subjects.find((x) => x.key === subj.key) ??
              ({ key: subj.key, grade: "F" as Grade, proficient: false } as ReportSubject);

            const eff = effectiveGrade(row.grade, row.proficient, cs.proficiencyBonus);

            return (
              <div key={subj.key} className="grid grid-cols-12 gap-2 p-3 border-b last:border-b-0 items-center">
                <div className="col-span-5 font-medium">{subj.label}</div>

                <div className="col-span-3">
                  <select
                    className="border rounded-md p-2 w-full"
                    value={row.grade}
                    disabled={busy}
                    onChange={(e) =>
                      setCs((p) => ({
                        ...p,
                        reportCard: {
                          ...p.reportCard,
                          subjects: p.reportCard.subjects.map((s) =>
                            s.key === subj.key ? { ...s, grade: e.target.value as Grade } : s
                          ),
                        },
                      }))
                    }
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={row.proficient}
                    disabled={busy}
                    onChange={(e) =>
                      setCs((p) => ({
                        ...p,
                        reportCard: {
                          ...p.reportCard,
                          subjects: p.reportCard.subjects.map((s) =>
                            s.key === subj.key ? { ...s, proficient: e.target.checked } : s
                          ),
                        },
                      }))
                    }
                  />
                  <span className="text-sm">Yes</span>
                </div>

                <div className="col-span-2 font-semibold">{eff}</div>
              </div>
            );
          })}
        </div>

        <textarea
          className="border rounded-md p-2 w-full"
          rows={3}
          placeholder="Notes (optional)"
          value={cs.reportCard.notes ?? ""}
          disabled={busy}
          onChange={(e) => setCs((p) => ({ ...p, reportCard: { ...p.reportCard, notes: e.target.value } }))}
        />
        <div className="text-xs text-gray-600">Notes are saved when you press “Save character sheet”.</div>
      </section>

      {/* Derived */}
      <section className="border rounded-xl p-4 space-y-3">
        <h3 className="font-medium">Combat & derived</h3>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="border rounded-lg p-3 space-y-1">
            <div className="text-xs text-gray-600">Max HP</div>
            <div className="text-sm text-gray-700">
              Base: <span className="font-medium">{hpMaxBase}</span>{" "}
              <span className="text-xs text-gray-500">(default {defaultHpMax})</span>
            </div>
            {equipDerivedBonus.hpMax ? (
              <div className="text-xs text-gray-500">Equip bonus: {fmtSigned(equipDerivedBonus.hpMax)}</div>
            ) : null}
            <input
              className="border rounded-md p-2 w-full"
              placeholder="Override (optional)"
              value={cs.derived.hpMaxOverride === null ? "" : String(cs.derived.hpMaxOverride)}
              inputMode="numeric"
              onChange={(e) =>
                setCs((p) => ({
                  ...p,
                  derived: { ...p.derived, hpMaxOverride: e.target.value.trim() === "" ? null : toInt(e.target.value, 0) },
                }))
              }
            />
            <div className="text-xs text-gray-500">Effective: {hpMax}</div>
          </div>

          <div className="border rounded-lg p-3 space-y-1">
            <div className="text-xs text-gray-600">Current HP</div>
            <input
              className="border rounded-md p-2 w-full"
              value={String(cs.derived.hpCurrent)}
              inputMode="numeric"
              onChange={(e) =>
                setCs((p) => ({ ...p, derived: { ...p.derived, hpCurrent: toInt(e.target.value, p.derived.hpCurrent) } }))
              }
            />
            <div className="text-xs text-gray-500">Out of {hpMax}</div>
          </div>

          <div className="border rounded-lg p-3 space-y-1">
            <div className="text-xs text-gray-600">Armor Class</div>
            <div className="text-sm text-gray-700">Base: <span className="font-medium">{acBase}</span></div>
            {equipDerivedBonus.ac ? (
              <div className="text-xs text-gray-500">Equip bonus: {fmtSigned(equipDerivedBonus.ac)}</div>
            ) : null}
            <input
              className="border rounded-md p-2 w-full"
              placeholder="Override (optional)"
              value={cs.derived.acOverride === null ? "" : String(cs.derived.acOverride)}
              inputMode="numeric"
              onChange={(e) =>
                setCs((p) => ({
                  ...p,
                  derived: { ...p.derived, acOverride: e.target.value.trim() === "" ? null : toInt(e.target.value, 0) },
                }))
              }
            />
            <div className="text-xs text-gray-500">Effective: {ac}</div>
          </div>

          <div className="border rounded-lg p-3 space-y-1">
            <div className="text-xs text-gray-600">Initiative</div>
            <div className="text-sm text-gray-700">Base: <span className="font-medium">{initiativeBase}</span></div>
            {equipDerivedBonus.initiative ? (
              <div className="text-xs text-gray-500">Equip bonus: {fmtSigned(equipDerivedBonus.initiative)}</div>
            ) : null}
            <input
              className="border rounded-md p-2 w-full"
              placeholder="Override (optional)"
              value={cs.derived.initiativeOverride === null ? "" : String(cs.derived.initiativeOverride)}
              inputMode="numeric"
              onChange={(e) =>
                setCs((p) => ({
                  ...p,
                  derived: {
                    ...p.derived,
                    initiativeOverride: e.target.value.trim() === "" ? null : toInt(e.target.value, 0),
                  },
                }))
              }
            />
            <div className="text-xs text-gray-500">Effective: {initiative}</div>
          </div>

          <div className="border rounded-lg p-3 space-y-1">
            <div className="text-xs text-gray-600">Speed</div>
            <div className="text-sm text-gray-700">Base: <span className="font-medium">{speedBase}</span></div>
            {equipDerivedBonus.speed ? (
              <div className="text-xs text-gray-500">Equip bonus: {fmtSigned(equipDerivedBonus.speed)}</div>
            ) : null}
            <input
              className="border rounded-md p-2 w-full"
              placeholder="Override (optional)"
              value={cs.derived.speedOverride === null ? "" : String(cs.derived.speedOverride)}
              inputMode="numeric"
              onChange={(e) =>
                setCs((p) => ({
                  ...p,
                  derived: { ...p.derived, speedOverride: e.target.value.trim() === "" ? null : toInt(e.target.value, 0) },
                }))
              }
            />
            <div className="text-xs text-gray-500">Effective: {speed}</div>
          </div>

          <div className="border rounded-lg p-3 space-y-1">
            <div className="text-xs text-gray-600">Passive Perception</div>
            <div className="text-sm text-gray-700">Base: <span className="font-medium">{passivePerceptionBase}</span></div>
            {equipDerivedBonus.passivePerception ? (
              <div className="text-xs text-gray-500">Equip bonus: {fmtSigned(equipDerivedBonus.passivePerception)}</div>
            ) : null}
            <input
              className="border rounded-md p-2 w-full"
              placeholder="Override (optional)"
              value={cs.derived.passivePerceptionOverride === null ? "" : String(cs.derived.passivePerceptionOverride)}
              inputMode="numeric"
              onChange={(e) =>
                setCs((p) => ({
                  ...p,
                  derived: {
                    ...p.derived,
                    passivePerceptionOverride: e.target.value.trim() === "" ? null : toInt(e.target.value, 0),
                  },
                }))
              }
            />
            <div className="text-xs text-gray-500">Effective: {passivePerception}</div>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="px-3 py-2 rounded-lg border bg-black text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save character sheet"}
          </button>
        </div>
      </section>
    </div>
  );
}
