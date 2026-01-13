import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ABILITIES = ["physical", "mental", "magic", "intelligence", "diplomacy", "incivility"] as const;
type AbilityKey = (typeof ABILITIES)[number];

const SKILL_KEYS = [
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
type SkillKey = (typeof SKILL_KEYS)[number];

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

const ITEM_KINDS: ItemKind[] = ["equipment", "consumable", "key", "other"];
const EQUIP_SLOTS: EquipSlot[] = [
  "main_hand",
  "offhand",
  "head",
  "body",
  "hands",
  "legs",
  "feet",
  "accessory",
];

function isString(x: any): x is string {
  return typeof x === "string";
}
function isInt(x: any): x is number {
  return Number.isInteger(x);
}
function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function inList<T extends string>(x: any, list: readonly T[]): x is T {
  return typeof x === "string" && (list as readonly string[]).includes(x);
}
function numOr0(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

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

function normalizeFromV1(raw: any): ItemV2 | null {
  if (!raw || typeof raw !== "object") return null;

  const id = isString(raw.id) ? raw.id : null;
  const name = isString(raw.name) ? raw.name : null;
  if (!id || !name) return null;

  const qty = Number.isFinite(Number(raw.qty)) ? Math.max(0, Math.trunc(Number(raw.qty))) : 1;
  const notes = isString(raw.notes) ? raw.notes : "";

  return {
    id,
    kind: "other",
    name: name.trim().slice(0, 120) || "(unnamed)",
    qty,
    description: notes.slice(0, 4000),
  };
}

function cleanModifiers(raw: any) {
  // only integers, clamp to a sane range
  const clamp = (n: any) => clampInt(Math.trunc(numOr0(n)), -999, 999);

  const out: any = {};
  if (!raw || typeof raw !== "object") return out;

  if (raw.abilities && typeof raw.abilities === "object") {
    const ab: any = {};
    for (const k of ABILITIES) {
      if (raw.abilities[k] !== undefined) {
        const v = clamp(raw.abilities[k]);
        if (v !== 0) ab[k] = v;
      }
    }
    if (Object.keys(ab).length) out.abilities = ab;
  }

  if (raw.saves && typeof raw.saves === "object") {
    const sv: any = {};
    for (const k of ABILITIES) {
      if (raw.saves[k] !== undefined) {
        const v = clamp(raw.saves[k]);
        if (v !== 0) sv[k] = v;
      }
    }
    if (Object.keys(sv).length) out.saves = sv;
  }

  if (raw.skills && typeof raw.skills === "object") {
    const sk: any = {};
    for (const k of SKILL_KEYS) {
      if (raw.skills[k] !== undefined) {
        const v = clamp(raw.skills[k]);
        if (v !== 0) sk[k] = v;
      }
    }
    if (Object.keys(sk).length) out.skills = sk;
  }

  if (raw.derived && typeof raw.derived === "object") {
    const dr: any = {};
    for (const key of ["hpMax", "ac", "initiative", "speed", "passivePerception"] as const) {
      if (raw.derived[key] !== undefined) {
        const v = clamp(raw.derived[key]);
        if (v !== 0) dr[key] = v;
      }
    }
    if (Object.keys(dr).length) out.derived = dr;
  }

  return out;
}

function cleanItem(raw: any): ItemV2 | null {
  if (!raw || typeof raw !== "object") return null;

  // v2?
  const kind = raw.kind;
  if (!inList(kind, ITEM_KINDS)) {
    // try v1 fallback
    return normalizeFromV1(raw);
  }

  const id = isString(raw.id) ? raw.id : null;
  const name = isString(raw.name) ? raw.name.trim() : "";
  if (!id) return null;
  if (!name) return null;

  const qty = Number.isFinite(Number(raw.qty)) ? Math.max(0, Math.trunc(Number(raw.qty))) : 0;

  const base: ItemV2 = {
    id,
    kind,
    name: name.slice(0, 120),
    qty,
    description: isString(raw.description) ? raw.description.slice(0, 4000) : "",
  };

  if (kind === "key") {
    base.qty = 1;
  }

  if (kind !== "equipment") {
    // strip equipment-only fields
    return base;
  }

  // equipment
  const slot = inList(raw.slot, EQUIP_SLOTS) ? (raw.slot as EquipSlot) : "main_hand";
  const equipped = Boolean(raw.equipped) && base.qty > 0;
  const modifiers = cleanModifiers(raw.modifiers);

  return {
    ...base,
    slot,
    equipped,
    modifiers,
  };
}

function enforceEquipRules(items: ItemV2[]): ItemV2[] {
  // qty 0 -> not equipped
  for (const it of items) {
    if (it.kind === "equipment" && it.qty <= 0) it.equipped = false;
  }

  // Enforce max equipped per slot: accessory=2, else=1
  const bySlot = new Map<EquipSlot, ItemV2[]>();
  for (const it of items) {
    if (it.kind !== "equipment") continue;
    const slot = (it.slot ?? "main_hand") as EquipSlot;
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot)!.push(it);
  }

  for (const [slot, list] of bySlot.entries()) {
    const cap = slot === "accessory" ? 2 : 1;

    let equippedCount = 0;
    for (const it of list) {
      if (!it.equipped) continue;
      equippedCount++;
      if (equippedCount > cap) it.equipped = false;
    }
  }

  return items;
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = isString(body?.campaignId) ? body.campaignId : "";
  const characterId = isString(body?.characterId) ? body.characterId : "";
  const itemsRaw = Array.isArray(body?.items) ? body.items : null;

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!characterId) return NextResponse.json({ error: "Missing characterId" }, { status: 400 });
  if (!itemsRaw) return NextResponse.json({ error: "Missing items" }, { status: 400 });

  if (itemsRaw.length > 500) return NextResponse.json({ error: "Too many items" }, { status: 400 });

  const cleaned: ItemV2[] = [];
  for (const raw of itemsRaw) {
    const it = cleanItem(raw);
    if (!it) return NextResponse.json({ error: "Invalid item payload" }, { status: 400 });
    cleaned.push(it);
  }

  enforceEquipRules(cleaned);

  // Preserve other keys in sheet (characterSheet, etc.)
  const { data: character, error: readErr } = await supabase
    .from("characters")
    .select("sheet")
    .eq("id", characterId)
    .eq("campaign_id", campaignId)
    .single();

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 400 });

  const sheet = (character?.sheet ?? {}) as any;
  const nextSheet = { ...sheet, items: cleaned };

  const { error: writeErr } = await supabase
    .from("characters")
    .update({ sheet: nextSheet })
    .eq("id", characterId)
    .eq("campaign_id", campaignId);

  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
