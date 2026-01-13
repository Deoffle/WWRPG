"use client";

import { useState } from "react";

export default function CreateInviteCard({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const [maxUses, setMaxUses] = useState("1");
  const [expiresDays, setExpiresDays] = useState("7");

  async function create() {
    setErr(null);
    setBusy(true);
    setCode(null);

    const mu = Math.max(1, parseInt(maxUses || "1", 10) || 1);
    const days = Math.max(1, parseInt(expiresDays || "7", 10) || 7);

    const res = await fetch("/api/invites/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        maxUses: mu,
        expiresInHours: days * 24,
      }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to create invite.");
      return;
    }

    setCode(json.code);
  }

  const inviteUrl = code ? `${window.location.origin}/join/${code}` : null;

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // ignore (clipboard permissions)
    }
  }

  return (
    <section className="border rounded-xl p-4 space-y-3">
      <h2 className="font-medium">Invite link (DM)</h2>

      <div className="grid gap-3 sm:grid-cols-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-gray-600">Max uses</label>
          <input
            className="border rounded-md p-2 w-full"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="e.g. 1"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-600">Expires (days)</label>
          <input
            className="border rounded-md p-2 w-full"
            value={expiresDays}
            onChange={(e) => setExpiresDays(e.target.value)}
            placeholder="e.g. 7"
          />
        </div>

        <button
          className="border rounded-md px-3 py-2"
          disabled={busy}
          onClick={create}
          type="button"
        >
          {busy ? "Creating…" : "Create invite"}
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {inviteUrl && (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">Share this link:</div>
          <pre className="text-xs overflow-auto border rounded-lg p-3">{inviteUrl}</pre>
          <button className="border rounded-md px-3 py-2" type="button" onClick={copy}>
            Copy link
          </button>
        </div>
      )}

      <p className="text-xs text-gray-600">
        Max uses = how many people can use the same link. Expires = how long the link stays valid.
      </p>
    </section>
  );
}
