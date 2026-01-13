"use client";

import { useState } from "react";

export default function BackupClient({ campaignId }: { campaignId: string }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function downloadExport() {
    setErr(null);
    setBusy(true);

    const res = await fetch(`/api/campaigns/export?campaignId=${campaignId}&includeAssets=1`);
    const json = await res.json().catch(() => ({}));

    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Export failed.");
      return;
    }

    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-export-${campaignId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="space-y-2">
        <div className="font-medium">Export</div>
        <button className="border rounded-md px-3 py-2" disabled={busy} onClick={downloadExport}>
          {busy ? "Working…" : "Download campaign JSON"}
        </button>
        <p className="text-xs text-gray-600">
          DM only. Includes characters, decks, cards, monsters, bestiary entries.
        </p>
      </div>

      <p className="text-xs text-gray-600 border-t pt-3">
        Import creates a <span className="font-medium">new campaign</span> and lives on the{" "}
        <span className="font-medium">Campaigns</span> overview page.
      </p>
    </div>
  );
}
