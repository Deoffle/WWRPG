"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateCampaignForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setErr("Please enter a campaign name.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/campaigns/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });

    const json = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to create campaign.");
      return;
    }

    setName("");
    router.refresh(); // refresh server component list
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-md p-2"
          placeholder="e.g. Wizarding World RPG"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="border rounded-md px-3 py-2" disabled={loading} type="submit">
          {loading ? "Creating…" : "Create"}
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
    </form>
  );
}
