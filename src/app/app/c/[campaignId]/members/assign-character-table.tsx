"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MemberRow = {
  user_id: string;
  role: "dm" | "character";
  character_id: string | null;
};

type CharacterRow = {
  id: string;
  name: string;
};

export default function AssignCharacterTable({
  campaignId,
  members,
  characters,
}: {
  campaignId: string;
  members: MemberRow[];
  characters: CharacterRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function assign(userId: string, characterId: string | null) {
    setErr(null);
    setBusyId(userId);

    const res = await fetch("/api/members/assign-character", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, userId, characterId }),
    });

    const json = await res.json().catch(() => ({}));
    setBusyId(null);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to assign character.");
      return;
    }

    router.refresh();
  }

  return (
    <section className="border rounded-xl p-4 space-y-3">
      <h2 className="font-medium">Assign character sheets (DM)</h2>
      <p className="text-sm text-gray-600">
        Pick which <span className="font-medium">Character</span> row belongs to each member. NPCs can stay unassigned.
      </p>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.user_id} className="border rounded-lg p-3">
            <div className="text-sm text-gray-600">user_id: {m.user_id}</div>
            <div className="text-sm">
              Role: <span className="font-medium">{m.role}</span>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-3 items-center">
              <label className="text-sm text-gray-600">Assigned character</label>

              <select
                className="border rounded-md p-2 sm:col-span-2"
                value={m.character_id ?? ""}
                disabled={busyId === m.user_id}
                onChange={(e) => {
                  const v = e.target.value;
                  assign(m.user_id, v === "" ? null : v);
                }}
              >
                <option value="">(None / NPC / not assigned)</option>
                {characters.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.id.slice(0, 8)}…
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600">
        If you’re not DM, RLS will block assignment updates.
      </p>
    </section>
  );
}
