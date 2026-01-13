"use client";

import { useMemo, useState, type FormEvent } from "react";
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
  { key: "learning", label: "Learning", ability: "mental" },
  { key: "perception", label: "Perception", ability: "mental" },
  { key: "performance", label: "Performance", ability: "incivility" },
  { key: "persuasion", label: "Persuasion", ability: "diplomacy" },
  { key: "sleight_of_hand", label: "Sleight of Hand", ability: "physical" },
  { key: "spells", label: "Spells", ability: "magic" },
] as const;

type SkillKey = (typeof SKILLS)[number]["key"];

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

  // equipment-only:
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

const DERIVED_FIELDS = [
  { key: "hpMax", label: "Max HP" },
  { key: "ac", label: "AC" },
  { key: "initiative", label: "Initiative" },
  { key: "speed", label: "Speed" },
  { key: "passivePerception", label: "Passive perception" },
] as const;

const SLOT_ORDER: EquipSlot[] = [
  "main_hand",
  "offhand",
  "head",
  "body",
  "hands",
  "legs",
  "feet",
  "accessory",
];

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function toInt(s: string, fallback = 0) {
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function slotLabel(s: EquipSlot) {
  switch (s) {
    case "main_hand":
      return "Main hand";
    case "offhand":
      return "Offhand";
    case "head":
      return "Head";
    case "body":
      return "Body";
    case "hands":
      return "Hands";
    case "legs":
      return "Legs";
    case "feet":
      return "Feet";
    case "accessory":
      return "Accessory";
  }
}

function fmtSigned(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function normalizeItems(input: any): ItemV2[] {
  // supports:
  // - v2 structure
  // - old v1 {id,name,qty,tags,notes} -> becomes kind="other", description=notes
  if (!Array.isArray(input)) return [];

  const out: ItemV2[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;

    const kind = raw.kind as ItemKind | undefined;
    const isV2 = kind === "equipment" || kind === "consumable" || kind === "key" || kind === "other";

    if (isV2) {
      const id = typeof raw.id === "string" ? raw.id : uid();
      const name = typeof raw.name === "string" ? raw.name : "(unnamed)";
      const qty = Number.isFinite(Number(raw.qty)) ? Math.max(0, Math.trunc(Number(raw.qty))) : 1;

      const item: ItemV2 = {
        id,
        kind,
        name,
        qty,
        description: typeof raw.description === "string" ? raw.description : "",
      };

      if (kind === "equipment") {
        item.slot = typeof raw.slot === "string" ? (raw.slot as any) : "main_hand";
        item.equipped = Boolean(raw.equipped) && qty > 0;
        item.modifiers = raw.modifiers && typeof raw.modifiers === "object" ? raw.modifiers : {};
      }

      out.push(item);
      continue;
    }

    // v1 fallback
    const id = typeof raw.id === "string" ? raw.id : uid();
    const name = typeof raw.name === "string" ? raw.name : "(unnamed)";
    const qty = Number.isFinite(Number(raw.qty)) ? Math.max(0, Math.trunc(Number(raw.qty))) : 1;
    const notes = typeof raw.notes === "string" ? raw.notes : "";

    out.push({
      id,
      kind: "other",
      name,
      qty,
      description: notes,
    });
  }

  return out;
}

function summarizeEquipmentModifiers(it: ItemV2) {
  // Only for equipment
  const active = Boolean(it.equipped);
  const lines: string[] = [];

  const ab = it.modifiers?.abilities ?? {};
  const sv = it.modifiers?.saves ?? {};
  const sk = it.modifiers?.skills ?? {};
  const dr = it.modifiers?.derived ?? {};

  for (const k of ABILITIES) {
    const v = (ab as any)[k];
    if (Number.isInteger(v) && v !== 0) lines.push(`Core ${k}: ${fmtSigned(v)}`);
  }
  for (const k of ABILITIES) {
    const v = (sv as any)[k];
    if (Number.isInteger(v) && v !== 0) lines.push(`Save ${k}: ${fmtSigned(v)}`);
  }
  for (const s of SKILLS) {
    const v = (sk as any)[s.key];
    if (Number.isInteger(v) && v !== 0) lines.push(`${s.label}: ${fmtSigned(v)}`);
  }
  for (const d of DERIVED_FIELDS) {
    const v = (dr as any)[d.key];
    if (Number.isInteger(v) && v !== 0) lines.push(`${d.label}: ${fmtSigned(v)}`);
  }

  if (lines.length === 0) lines.push("No modifiers set.");

  return { active, lines };
}

function sanitizeEquipmentOnly(it: ItemV2): ItemV2 {
  if (it.kind !== "equipment") {
    // strip equipment-only fields
    const { slot, equipped, modifiers, ...rest } = it as any;
    return rest as ItemV2;
  }
  // equipment: ensure basics
  return {
    ...it,
    slot: (it.slot ?? "main_hand") as EquipSlot,
    equipped: Boolean(it.equipped) && (it.qty ?? 0) > 0,
    modifiers: it.modifiers ?? {},
  };
}

function enforceEquipRules(items: ItemV2[]): ItemV2[] {
  // Server does this too, but keep the client consistent:
  // - non-accessory slots: max 1 equipped
  // - accessory slot: max 2 equipped
  const next = items.map(sanitizeEquipmentOnly);

  // if qty is 0, force unequip
  for (const it of next) {
    if (it.kind === "equipment" && (it.qty ?? 0) <= 0 && it.equipped) it.equipped = false;
  }

  const bySlot = new Map<EquipSlot, ItemV2[]>();
  for (const it of next) {
    if (it.kind !== "equipment") continue;
    const slot = (it.slot ?? "main_hand") as EquipSlot;
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot)!.push(it);
  }

  for (const [slot, list] of bySlot.entries()) {
    const equipped = list.filter((x) => x.equipped);

    const cap = slot === "accessory" ? 2 : 1;
    if (equipped.length <= cap) continue;

    // Unequip extras: keep the most recently modified by UI order is unknown,
    // so keep the first `cap` in the list and unequip the rest deterministically.
    // (This is fine because you also auto-unequip on click.)
    let kept = 0;
    for (const it of list) {
      if (!it.equipped) continue;
      if (kept < cap) {
        kept++;
      } else {
        it.equipped = false;
      }
    }
  }

  return next;
}

export default function ItemsEditor({
  campaignId,
  characterId,
  initialItems,
}: {
  campaignId: string;
  characterId: string;
  initialItems: any[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<ItemV2[]>(() => enforceEquipRules(normalizeItems(initialItems)));

  // Add form
  const [kind, setKind] = useState<ItemKind>("equipment");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [desc, setDesc] = useState("");
  const [slot, setSlot] = useState<EquipSlot>("main_hand");

  // Add form modifiers drafts (strings) — equipment only
  const [mAbilities, setMAbilities] = useState<Record<AbilityKey, string>>(
    () => Object.fromEntries(ABILITIES.map((k) => [k, "0"])) as any
  );
  const [mSaves, setMSaves] = useState<Record<AbilityKey, string>>(
    () => Object.fromEntries(ABILITIES.map((k) => [k, "0"])) as any
  );
  const [mSkills, setMSkills] = useState<Record<string, string>>(
    () => Object.fromEntries(SKILLS.map((s) => [s.key, "0"]))
  );
  const [mDerived, setMDerived] = useState<Record<string, string>>(
    () => Object.fromEntries(DERIVED_FIELDS.map((d) => [d.key, "0"]))
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sections = useMemo(() => {
    const eq = items.filter((i) => i.kind === "equipment");
    const con = items.filter((i) => i.kind === "consumable");
    const key = items.filter((i) => i.kind === "key");
    const oth = items.filter((i) => i.kind === "other");
    return { eq, con, key, oth };
  }, [items]);

  const equipmentBySlot = useMemo(() => {
    const map = new Map<EquipSlot, ItemV2[]>();
    for (const s of SLOT_ORDER) map.set(s, []);
    for (const it of sections.eq) {
      const slot = (it.slot ?? "main_hand") as EquipSlot;
      map.get(slot)?.push(it);
    }
    return map;
  }, [sections.eq]);

  async function save(nextRaw: ItemV2[]) {
    setErr(null);
    setBusy(true);

    const next = enforceEquipRules(nextRaw);

    const res = await fetch("/api/characters/items/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, characterId, items: next }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to save items.");
      return false;
    }

    setItems(next);
    router.refresh();
    return true;
  }

  function cleanedModifiers() {
    // only keep non-zero entries
    const abilities: Partial<Record<AbilityKey, number>> = {};
    const saves: Partial<Record<AbilityKey, number>> = {};
    const skills: Partial<Record<SkillKey, number>> = {};
    const derived: any = {};

    for (const k of ABILITIES) {
      const v = toInt(mAbilities[k] ?? "0", 0);
      if (v !== 0) abilities[k] = v;
    }
    for (const k of ABILITIES) {
      const v = toInt(mSaves[k] ?? "0", 0);
      if (v !== 0) saves[k] = v;
    }
    for (const s of SKILLS) {
      const v = toInt(mSkills[s.key] ?? "0", 0);
      if (v !== 0) (skills as any)[s.key] = v;
    }
    for (const d of DERIVED_FIELDS) {
      const v = toInt(mDerived[d.key] ?? "0", 0);
      if (v !== 0) derived[d.key] = v;
    }

    const out: any = {};
    if (Object.keys(abilities).length) out.abilities = abilities;
    if (Object.keys(saves).length) out.saves = saves;
    if (Object.keys(skills).length) out.skills = skills;
    if (Object.keys(derived).length) out.derived = derived;

    return out;
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();

    const nm = name.trim();
    if (!nm) return setErr("Enter an item name.");

    const q = Math.max(0, Math.trunc(Number(qty)));
    if (!Number.isFinite(Number(qty)) || !Number.isInteger(Number(qty)) || q < 0) {
      return setErr("Quantity must be a whole number ≥ 0.");
    }

    const base: ItemV2 = {
      id: uid(),
      kind,
      name: nm,
      qty: kind === "key" ? 1 : q,
      description: desc.trim(),
    };

    if (kind === "equipment") {
      base.slot = slot;
      base.equipped = false;
      base.modifiers = cleanedModifiers();
    }

    const next = [base, ...items];

    const ok = await save(next);
    if (ok) {
      setName("");
      setQty("1");
      setDesc("");

      // reset modifiers drafts
      setMAbilities(Object.fromEntries(ABILITIES.map((k) => [k, "0"])) as any);
      setMSaves(Object.fromEntries(ABILITIES.map((k) => [k, "0"])) as any);
      setMSkills(Object.fromEntries(SKILLS.map((s) => [s.key, "0"])));
      setMDerived(Object.fromEntries(DERIVED_FIELDS.map((d) => [d.key, "0"])));
    }
  }

  async function removeItem(id: string) {
    await save(items.filter((it) => it.id !== id));
  }

  async function setQuantity(id: string, nextQty: number) {
    const next = items.map((it) => {
      if (it.id !== id) return it;
      const q = Math.max(0, nextQty);
      // if equipment qty hits 0 -> force unequip
      if (it.kind === "equipment") return { ...it, qty: q, equipped: q > 0 ? it.equipped : false };
      if (it.kind === "key") return { ...it, qty: 1 };
      return { ...it, qty: q };
    });
    await save(next);
  }

  async function updateItem(id: string, patch: Partial<ItemV2>) {
    const next = items.map((it) => (it.id === id ? ({ ...it, ...patch } as ItemV2) : it));
    await save(next);
  }

  async function toggleEquipped(id: string, nextEquipped: boolean) {
    const item = items.find((x) => x.id === id);
    if (!item || item.kind !== "equipment") return;

    const itemSlot = (item.slot ?? "main_hand") as EquipSlot;

    const next = items.map((it) => {
      if (it.id === id) return { ...it, equipped: nextEquipped && (it.qty ?? 0) > 0 };
      return it;
    });

    if (nextEquipped) {
      if (itemSlot === "accessory") {
        // allow 2 equipped accessories
        const equippedAcc = next.filter(
          (it) => it.kind === "equipment" && it.slot === "accessory" && it.equipped
        );
        if (equippedAcc.length > 2) {
          // unequip one deterministic: first one that isn't the item we just equipped
          const victim = equippedAcc.find((x) => x.id !== id);
          if (victim) {
            const idx = next.findIndex((x) => x.id === victim.id);
            if (idx >= 0) next[idx] = { ...next[idx], equipped: false };
          }
        }
      } else {
        // non-accessory: only one equipped in that slot
        for (let i = 0; i < next.length; i++) {
          const it = next[i];
          if (it.id === id) continue;
          if (it.kind === "equipment" && (it.slot ?? "main_hand") === itemSlot && it.equipped) {
            next[i] = { ...it, equipped: false };
          }
        }
      }
    }

    await save(next);
  }

  function renderItemRow(it: ItemV2) {
    const isEquip = it.kind === "equipment";
    const canQty = it.kind === "consumable" || it.kind === "other" || it.kind === "equipment";

    const summary = isEquip ? summarizeEquipmentModifiers(it) : null;

    return (
      <li key={it.id} className="border rounded-lg p-3 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="font-medium">{it.name}</div>
            <div className="text-xs text-gray-500">
              {it.kind.toUpperCase()}
              {isEquip && it.slot ? ` · slot: ${slotLabel(it.slot as EquipSlot)}` : ""}
              {isEquip ? ` · equipped: ${String(Boolean(it.equipped))}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isEquip ? (
              <label className="flex items-center gap-2 select-none text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(it.equipped)}
                  disabled={busy || (it.qty ?? 0) <= 0}
                  onChange={(e) => toggleEquipped(it.id, e.target.checked)}
                />
                Equipped
              </label>
            ) : null}

            {canQty ? (
              <div className="flex items-center gap-2">
                <button
                  className="border rounded-md px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                  type="button"
                  disabled={busy || it.qty <= 0 || it.kind === "key"}
                  onClick={() => setQuantity(it.id, it.qty - 1)}
                >
                  −
                </button>
                <div className="w-10 text-center">{it.qty}</div>
                <button
                  className="border rounded-md px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                  type="button"
                  disabled={busy || it.kind === "key"}
                  onClick={() => setQuantity(it.id, it.qty + 1)}
                >
                  +
                </button>
              </div>
            ) : null}

            <button
              className="border rounded-md px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
              type="button"
              disabled={busy}
              onClick={() => removeItem(it.id)}
            >
              Delete
            </button>
          </div>
        </div>

        {/* Description always visible */}
        <div className="text-sm text-gray-700 whitespace-pre-wrap">
          {it.description?.trim() ? it.description : <span className="text-gray-400">No description.</span>}
        </div>

        {/* Modifiers summary only for equipment (keeps other sections clean) */}
        {isEquip && summary ? (
          <div className="text-xs text-gray-600">
            <div className="font-medium">
              Active modifiers {summary.active ? "(active)" : "(inactive)"}
            </div>
            <ul className="list-disc pl-5">
              {summary.lines.slice(0, 6).map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
              {summary.lines.length > 6 ? <li>…and {summary.lines.length - 6} more</li> : null}
            </ul>
            {!summary.active ? <div className="text-gray-500">Equip the item to activate modifiers.</div> : null}
          </div>
        ) : null}

        {/* Edit panel */}
        <details className="border rounded-md p-2">
          <summary className="cursor-pointer text-sm">Edit item</summary>

          <div className="mt-3 space-y-4">
            <textarea
              className="border rounded-md p-2 w-full"
              rows={3}
              defaultValue={it.description ?? ""}
              placeholder="Description"
              onBlur={(e) => updateItem(it.id, { description: e.target.value })}
            />

            {isEquip ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <div className="text-xs text-gray-600">Slot</div>
                  <select
                    className="border rounded-md p-2 w-full"
                    value={(it.slot ?? "main_hand") as EquipSlot}
                    disabled={busy}
                    onChange={(e) => updateItem(it.id, { slot: e.target.value as EquipSlot })}
                  >
                    <option value="main_hand">Main hand</option>
                    <option value="offhand">Offhand</option>
                    <option value="head">Head</option>
                    <option value="body">Body</option>
                    <option value="hands">Hands</option>
                    <option value="legs">Legs</option>
                    <option value="feet">Feet</option>
                    <option value="accessory">Accessory</option>
                  </select>
                </label>
              </div>
            ) : null}

            {isEquip ? (
              <div className="border rounded-lg p-3 space-y-3">
                <div className="text-sm font-medium">Modifiers</div>
                <div className="text-xs text-gray-600">
                  Only equipped equipment applies modifiers. Zero values are ignored.
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  {/* Abilities */}
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="text-sm font-medium">Core stats</div>
                    {ABILITIES.map((k) => (
                      <label key={k} className="flex items-center justify-between gap-2">
                        <span className="text-sm capitalize">{k}</span>
                        <input
                          className="border rounded-md p-2 w-24"
                          defaultValue={String((it.modifiers?.abilities as any)?.[k] ?? 0)}
                          inputMode="numeric"
                          onBlur={(e) => {
                            const v = toInt(e.target.value, 0);
                            const next = {
                              ...(it.modifiers ?? {}),
                              abilities: { ...(it.modifiers?.abilities ?? {}), [k]: v },
                            };
                            updateItem(it.id, { modifiers: next });
                          }}
                        />
                      </label>
                    ))}
                  </div>

                  {/* Saves */}
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="text-sm font-medium">Saving throws</div>
                    {ABILITIES.map((k) => (
                      <label key={k} className="flex items-center justify-between gap-2">
                        <span className="text-sm capitalize">{k}</span>
                        <input
                          className="border rounded-md p-2 w-24"
                          defaultValue={String((it.modifiers?.saves as any)?.[k] ?? 0)}
                          inputMode="numeric"
                          onBlur={(e) => {
                            const v = toInt(e.target.value, 0);
                            const next = {
                              ...(it.modifiers ?? {}),
                              saves: { ...(it.modifiers?.saves ?? {}), [k]: v },
                            };
                            updateItem(it.id, { modifiers: next });
                          }}
                        />
                      </label>
                    ))}
                  </div>

                  {/* Derived */}
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="text-sm font-medium">Derived</div>
                    {DERIVED_FIELDS.map((d) => (
                      <label key={d.key} className="flex items-center justify-between gap-2">
                        <span className="text-sm">{d.label}</span>
                        <input
                          className="border rounded-md p-2 w-24"
                          defaultValue={String((it.modifiers?.derived as any)?.[d.key] ?? 0)}
                          inputMode="numeric"
                          onBlur={(e) => {
                            const v = toInt(e.target.value, 0);
                            const next = {
                              ...(it.modifiers ?? {}),
                              derived: { ...(it.modifiers?.derived ?? {}), [d.key]: v },
                            };
                            updateItem(it.id, { modifiers: next });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <details className="border rounded-md p-2">
                  <summary className="cursor-pointer text-sm">Skill modifiers (advanced)</summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {SKILLS.map((s) => (
                      <label key={s.key} className="flex items-center justify-between gap-2">
                        <span className="text-sm">{s.label}</span>
                        <input
                          className="border rounded-md p-2 w-24"
                          defaultValue={String((it.modifiers?.skills as any)?.[s.key] ?? 0)}
                          inputMode="numeric"
                          onBlur={(e) => {
                            const v = toInt(e.target.value, 0);
                            const next = {
                              ...(it.modifiers ?? {}),
                              skills: { ...(it.modifiers?.skills ?? {}), [s.key]: v },
                            };
                            updateItem(it.id, { modifiers: next });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </details>
              </div>
            ) : null}

            <div className="text-xs text-gray-600">Edits save when you click out of a field.</div>
          </div>
        </details>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add item */}
      <form onSubmit={addItem} className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-medium">Add item</h3>
          {busy ? <div className="text-xs text-gray-500">Saving…</div> : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-1">
            <div className="text-xs text-gray-600">Kind</div>
            <select
              className="border rounded-md p-2 w-full"
              value={kind}
              onChange={(e) => setKind(e.target.value as ItemKind)}
            >
              <option value="equipment">Equipment</option>
              <option value="consumable">Consumable</option>
              <option value="key">Key item</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="space-y-1 sm:col-span-2">
            <div className="text-xs text-gray-600">Name</div>
            <input
              className="border rounded-md p-2 w-full"
              placeholder="Item name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-1">
            <div className="text-xs text-gray-600">Qty</div>
            <input
              className="border rounded-md p-2 w-full"
              value={kind === "key" ? "1" : qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="numeric"
              disabled={kind === "key"}
            />
          </label>

          {kind === "equipment" ? (
            <label className="space-y-1 sm:col-span-2">
              <div className="text-xs text-gray-600">Slot</div>
              <select
                className="border rounded-md p-2 w-full"
                value={slot}
                onChange={(e) => setSlot(e.target.value as EquipSlot)}
              >
                <option value="main_hand">Main hand</option>
                <option value="offhand">Offhand</option>
                <option value="head">Head</option>
                <option value="body">Body</option>
                <option value="hands">Hands</option>
                <option value="legs">Legs</option>
                <option value="feet">Feet</option>
                <option value="accessory">Accessory</option>
              </select>
            </label>
          ) : (
            <div className="sm:col-span-2" />
          )}
        </div>

        <textarea
          className="border rounded-md p-2 w-full"
          rows={3}
          placeholder="Description"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />

        {kind === "equipment" ? (
          <details className="border rounded-md p-2">
            <summary className="cursor-pointer text-sm">Set modifiers (optional)</summary>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div className="border rounded-lg p-3 space-y-2">
                <div className="text-sm font-medium">Core stats</div>
                {ABILITIES.map((k) => (
                  <label key={k} className="flex items-center justify-between gap-2">
                    <span className="text-sm capitalize">{k}</span>
                    <input
                      className="border rounded-md p-2 w-24"
                      value={mAbilities[k] ?? "0"}
                      inputMode="numeric"
                      onChange={(e) => setMAbilities((p) => ({ ...p, [k]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="text-sm font-medium">Saving throws</div>
                {ABILITIES.map((k) => (
                  <label key={k} className="flex items-center justify-between gap-2">
                    <span className="text-sm capitalize">{k}</span>
                    <input
                      className="border rounded-md p-2 w-24"
                      value={mSaves[k] ?? "0"}
                      inputMode="numeric"
                      onChange={(e) => setMSaves((p) => ({ ...p, [k]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="text-sm font-medium">Derived</div>
                {DERIVED_FIELDS.map((d) => (
                  <label key={d.key} className="flex items-center justify-between gap-2">
                    <span className="text-sm">{d.label}</span>
                    <input
                      className="border rounded-md p-2 w-24"
                      value={mDerived[d.key] ?? "0"}
                      inputMode="numeric"
                      onChange={(e) => setMDerived((p) => ({ ...p, [d.key]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
            </div>

            <details className="border rounded-md p-2 mt-3">
              <summary className="cursor-pointer text-sm">Skill modifiers (advanced)</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {SKILLS.map((s) => (
                  <label key={s.key} className="flex items-center justify-between gap-2">
                    <span className="text-sm">{s.label}</span>
                    <input
                      className="border rounded-md p-2 w-24"
                      value={mSkills[s.key] ?? "0"}
                      inputMode="numeric"
                      onChange={(e) => setMSkills((p) => ({ ...p, [s.key]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
            </details>
          </details>
        ) : null}

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button
          className="px-3 py-2 rounded-lg border bg-black text-white hover:opacity-90 disabled:opacity-50"
          disabled={busy}
        >
          Add item
        </button>
      </form>

      {/* Sections */}
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="font-medium">Equipment</h3>

          {sections.eq.length === 0 ? (
            <p className="text-sm text-gray-600">None.</p>
          ) : (
            <div className="space-y-4">
              {SLOT_ORDER.map((slot) => {
                const list = equipmentBySlot.get(slot) ?? [];
                if (list.length === 0) return null;

                return (
                  <div key={slot} className="border rounded-xl p-3 space-y-2">
                    <div className="text-sm font-medium">{slotLabel(slot)}</div>
                    <ul className="space-y-2">{list.map(renderItemRow)}</ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>


        <section className="space-y-2">
          <h3 className="font-medium">Consumables</h3>
          {sections.con.length === 0 ? (
            <p className="text-sm text-gray-600">None.</p>
          ) : (
            <ul className="space-y-2">{sections.con.map(renderItemRow)}</ul>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Key items</h3>
          {sections.key.length === 0 ? (
            <p className="text-sm text-gray-600">None.</p>
          ) : (
            <ul className="space-y-2">{sections.key.map(renderItemRow)}</ul>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Other</h3>
          {sections.oth.length === 0 ? (
            <p className="text-sm text-gray-600">None.</p>
          ) : (
            <ul className="space-y-2">{sections.oth.map(renderItemRow)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}
