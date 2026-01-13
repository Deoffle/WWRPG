"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteCampaignCard({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function del() {
    setErr(null);
    if (confirmText !== "DELETE") {
      setErr('Type "DELETE" to confirm.');
      return;
    }

    setBusy(true);
    const res = await fetch("/api/campaigns/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to delete campaign.");
      return;
    }

    router.push("/app/campaigns");
    router.refresh();
  }

  return (
    <section className="border rounded-xl p-4 space-y-3">
      <h2 className="font-medium text-red-600">Danger zone</h2>
      <p className="text-sm text-gray-600">
        Deleting a campaign removes all members, characters, decks, cards, monsters, etc. This cannot be undone.
      </p>

      <div className="grid gap-2 sm:grid-cols-3 items-end">
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs text-gray-600">Type DELETE to confirm</label>
          <input
            className="border rounded-md p-2 w-full"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
          />
        </div>

        <button
          className="border rounded-md px-3 py-2 text-red-600"
          type="button"
          disabled={busy}
          onClick={del}
        >
          {busy ? "Deleting…" : "Delete campaign"}
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      <p className="text-xs text-gray-600">
        If you’re not the campaign owner, RLS will block this.
      </p>
    </section>
  );
}
