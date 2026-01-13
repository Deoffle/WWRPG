"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateCharacterForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isNpc, setIsNpc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const trimmed = name.trim();
    if (!trimmed) return setErr("Name cannot be empty.");

    setBusy(true);
    const res = await fetch("/api/characters/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, name: trimmed, isNpc }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to create character.");
      return;
    }

    setName("");
    setIsNpc(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="grid gap-2 sm:grid-cols-3 items-end">
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs text-gray-600">Name</label>
          <input
            className="border rounded-md p-2 w-full"
            placeholder="Character name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-600">NPC</label>
          <label className="border rounded-md p-2 w-full flex items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={isNpc}
              onChange={(e) => setIsNpc(e.target.checked)}
              disabled={busy}
            />
            <span className="text-sm">This character is an NPC</span>
          </label>
        </div>
      </div>

      <button className="border rounded-md px-3 py-2" type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create"}
      </button>

      <p className="text-xs text-gray-600">
        NPC characters can be excluded when you “Push to all” in monsters (Skip NPC).
      </p>
    </form>
  );
}
