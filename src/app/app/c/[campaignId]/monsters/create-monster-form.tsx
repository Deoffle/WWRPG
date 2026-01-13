"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateMonsterForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const nm = name.trim();
    if (!nm) return setErr("Enter a monster name.");

    setBusy(true);
    const res = await fetch("/api/monsters/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, name: nm, tags }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to create monster.");
      return;
    }

    setName("");
    setTags("");

    // Go straight to the monster detail page (we'll build it next)
    router.push(`/app/c/${campaignId}/monsters/${json.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        className="border rounded-md p-2 w-full"
        placeholder="Monster name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="border rounded-md p-2 w-full"
        placeholder="Tags (comma-separated) e.g. beast, flying, boss"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
      />

      {err && <p className="text-sm text-red-600">{err}</p>}

      <button className="border rounded-md px-3 py-2" disabled={busy}>
        {busy ? "Creating…" : "Create monster"}
      </button>
    </form>
  );
}
