"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Character = { id: string; name: string };

export default function CreateDeckForm({
  campaignId,
  characters,
}: {
  campaignId: string;
  characters: Character[];
}) {
  const router = useRouter();
  const [characterId, setCharacterId] = useState(characters[0]?.id ?? "");
  const [deckType, setDeckType] = useState<"combat" | "exploration">("combat");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!characterId) return setErr("Create a character first (Characters page).");

    setLoading(true);
    const res = await fetch("/api/decks/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        characterId,
        deckType,
        name: name.trim(),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) return setErr(json?.error ?? "Failed to create deck.");

    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          className="border rounded-md p-2"
          value={characterId}
          onChange={(e) => setCharacterId(e.target.value)}
        >
          {characters.length === 0 ? (
            <option value="">No characters yet</option>
          ) : (
            characters.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))
          )}
        </select>

        <select
          className="border rounded-md p-2"
          value={deckType}
          onChange={(e) => setDeckType(e.target.value as any)}
        >
          <option value="combat">combat</option>
          <option value="exploration">exploration</option>
        </select>

        <input
          className="border rounded-md p-2"
          placeholder="Deck name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <button className="border rounded-md px-3 py-2" disabled={loading}>
        {loading ? "Creating…" : "Create deck"}
      </button>
    </form>
  );
}
