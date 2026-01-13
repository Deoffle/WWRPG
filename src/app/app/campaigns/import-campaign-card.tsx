"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportCampaignCard() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [importName, setImportName] = useState("Imported campaign");
  const [fileText, setFileText] = useState<string>("");

  async function importDump() {
    setErr(null);
    const name = importName.trim();
    if (!name) return setErr("Please enter a name for the new campaign.");
    if (!fileText) return setErr("Please choose an export JSON file first.");

    let exportData: any = null;
    try {
      exportData = JSON.parse(fileText);
    } catch {
      return setErr("That file is not valid JSON.");
    }

    setBusy(true);
    const res = await fetch("/api/campaigns/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // IMPORTANT: send as { name, dump } (or { name, export })
      body: JSON.stringify({ name, dump: exportData }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Import failed.");
      return;
    }

    router.push(`/app/c/${json.newCampaignId}`);
    router.refresh();
  }

  return (
    <section className="border rounded-xl p-4 space-y-3">
      <div className="font-medium">Import (creates a new campaign)</div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="grid gap-2 sm:grid-cols-2 items-end">
        <div className="space-y-1">
          <label className="text-xs text-gray-600">New campaign name</label>
          <input
            className="border rounded-md p-2 w-full"
            value={importName}
            onChange={(e) => setImportName(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-600">Export file (.json)</label>
          <input
            className="border rounded-md p-2 w-full"
            type="file"
            accept="application/json"
            disabled={busy}
            onChange={async (e) => {
              setErr(null);
              const f = e.target.files?.[0];
              if (!f) return;
              const text = await f.text();
              setFileText(text);
            }}
          />
        </div>
      </div>

      <button className="border rounded-md px-3 py-2" disabled={busy} onClick={importDump}>
        {busy ? "Importing…" : "Import into new campaign"}
      </button>

      <p className="text-xs text-gray-600">
        Import generates <span className="font-medium">new IDs</span> to avoid collisions. Character{" "}
        <code>user_id</code> is set to null so you can re-assign later.
      </p>
    </section>
  );
}
