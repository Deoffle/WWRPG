"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NpcToggle({
  campaignId,
  characterId,
  initialIsNpc,
}: {
  campaignId: string;
  characterId: string;
  initialIsNpc: boolean;
}) {
  const router = useRouter();
  const [isNpc, setIsNpc] = useState(initialIsNpc);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(next: boolean) {
    setErr(null);
    setBusy(true);

    const res = await fetch("/api/characters/set-npc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, characterId, isNpc: next }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to update NPC flag.");
      return;
    }

    setIsNpc(next);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {err && <p className="text-sm text-red-600">{err}</p>}

      <label className="flex items-center gap-2 select-none">
        <input
          type="checkbox"
          checked={isNpc}
          disabled={busy}
          onChange={(e) => save(e.target.checked)}
        />
        <span className="text-sm">NPC character</span>
      </label>

      <p className="text-xs text-gray-600">
        Used by “Skip NPC” when pushing monsters to all characters.
      </p>
    </div>
  );
}
