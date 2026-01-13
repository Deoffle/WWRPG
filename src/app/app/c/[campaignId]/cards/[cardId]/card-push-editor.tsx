"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CharacterRow = { id: string; name: string };

type Structured = {
  encounter_type?: "combat" | "exploration" | "both";
};

function safeStructured(x: any): Structured {
  if (x && typeof x === "object") return x as Structured;
  if (typeof x === "string") {
    try {
      const parsed = JSON.parse(x);
      return parsed && typeof parsed === "object" ? (parsed as Structured) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function toInt(s: string, fallback = 0) {
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

export default function CardPushEditor({
  campaignId,
  cardId,
  characters,
  initialByCharacter,
  structured,
}: {
  campaignId: string;
  cardId: string;
  characters: CharacterRow[];
  initialByCharacter: Record<string, { combat: number; exploration: number }>;
  structured: any;
}) {
  const router = useRouter();

  const [characterId, setCharacterId] = useState(characters[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const encounterType = useMemo(() => {
    const s = safeStructured(structured);
    return s.encounter_type === "combat" || s.encounter_type === "exploration" || s.encounter_type === "both"
      ? s.encounter_type
      : "both";
  }, [structured]);

  const initial = initialByCharacter[characterId] ?? { combat: 0, exploration: 0 };

  const [combatQty, setCombatQty] = useState<string>(String(initial.combat));
  const [explorationQty, setExplorationQty] = useState<string>(String(initial.exploration));

  // When switching character, refresh inputs
  function onPickCharacter(id: string) {
    setCharacterId(id);
    const next = initialByCharacter[id] ?? { combat: 0, exploration: 0 };
    setCombatQty(String(next.combat));
    setExplorationQty(String(next.exploration));
    setErr(null);
  }

  async function save() {
    setErr(null);
    setBusy(true);

    const res = await fetch("/api/cards/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        cardId,
        characterId,
        combatQty: Math.max(0, toInt(combatQty, 0)),
        explorationQty: Math.max(0, toInt(explorationQty, 0)),
      }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to push card.");
      return;
    }

    router.refresh();
  }

  const showCombat = encounterType === "combat" || encounterType === "both";
  const showExploration = encounterType === "exploration" || encounterType === "both";

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <div className="text-xs text-gray-600">Character</div>
          <select
            className="border rounded-md p-2 w-full"
            value={characterId}
            onChange={(e) => onPickCharacter(e.target.value)}
          >
            {characters.length === 0 ? <option value="">No characters</option> : null}
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="text-xs text-gray-600 flex items-end">
          Encounter type: <span className="ml-2 font-medium">{encounterType}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {showCombat ? (
          <div className="border rounded-lg p-3 space-y-2">
            <div className="font-medium">Combat deck</div>

            <label className="flex items-center gap-2 select-none text-sm">
              <input
                type="checkbox"
                checked={Math.max(0, toInt(combatQty, 0)) > 0}
                onChange={(e) => setCombatQty(e.target.checked ? "1" : "0")}
                disabled={busy}
              />
              Enabled
            </label>

            <label className="space-y-1 block">
              <div className="text-xs text-gray-600">Quantity</div>
              <input
                className="border rounded-md p-2 w-full"
                inputMode="numeric"
                value={combatQty}
                onChange={(e) => setCombatQty(e.target.value)}
                disabled={busy}
              />
            </label>
            <div className="text-xs text-gray-500">0 = not pushed</div>
          </div>
        ) : (
          <div className="border rounded-lg p-3 text-sm text-gray-500">
            Combat push disabled (card is {encounterType} only).
          </div>
        )}

        {showExploration ? (
          <div className="border rounded-lg p-3 space-y-2">
            <div className="font-medium">Exploration deck</div>

            <label className="flex items-center gap-2 select-none text-sm">
              <input
                type="checkbox"
                checked={Math.max(0, toInt(explorationQty, 0)) > 0}
                onChange={(e) => setExplorationQty(e.target.checked ? "1" : "0")}
                disabled={busy}
              />
              Enabled
            </label>

            <label className="space-y-1 block">
              <div className="text-xs text-gray-600">Quantity</div>
              <input
                className="border rounded-md p-2 w-full"
                inputMode="numeric"
                value={explorationQty}
                onChange={(e) => setExplorationQty(e.target.value)}
                disabled={busy}
              />
            </label>
            <div className="text-xs text-gray-500">0 = not pushed</div>
          </div>
        ) : (
          <div className="border rounded-lg p-3 text-sm text-gray-500">
            Exploration push disabled (card is {encounterType} only).
          </div>
        )}
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <button
        type="button"
        onClick={save}
        disabled={busy || !characterId}
        className="border rounded-md px-3 py-2 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save push settings"}
      </button>

      <p className="text-xs text-gray-600">
        Setting quantity to 0 removes the card from that character’s deck.
      </p>
    </div>
  );
}
