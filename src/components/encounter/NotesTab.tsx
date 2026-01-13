"use client";

import { useMemo } from "react";
import { useCampaignPlayerNotes } from "@/hooks/useCampaignPlayerNotes";

export function NotesTab({ campaignId }: { campaignId: string }) {
  const { state, setValue, flushSave } = useCampaignPlayerNotes(campaignId);
  const { value, isLoading, isSaving, lastSavedAt, error } = state;

  const savedLabel = useMemo(() => {
    if (!lastSavedAt) return "";
    const d = new Date(lastSavedAt);
    if (Number.isNaN(d.getTime())) return "";
    return `Last saved: ${d.toLocaleString()}`;
  }, [lastSavedAt]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm opacity-80">
          {isLoading ? "Loading notes…" : isSaving ? "Saving…" : savedLabel}
        </div>

        <button
          type="button"
          onClick={() => void flushSave(value ?? "")}
          className="rounded-md border px-3 py-1 text-sm hover:bg-black/5"
          disabled={isLoading || isSaving}
          title="Force save now"
        >
          Save
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm">
          {error}
        </div>
      ) : null}

      <textarea
        className="min-h-[220px] w-full resize-y rounded-md border p-3 text-sm outline-none"
        placeholder="Write anything you want here. These notes persist across encounters."
        value={value ?? ""}
        onChange={(e) => setValue(e.target.value)}
        disabled={isLoading}
      />
    </div>
  );
}
