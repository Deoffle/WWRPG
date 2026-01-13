"use client";

import { useEffect, useMemo, useRef } from "react";
import { useCampaignPlayerNotes } from "@/hooks/useCampaignPlayerNotes";

export default function NotesPanel({
  campaignId,
}: {
  campaignId: string;
  encounterId: string | null; // ok to accept even if unused
  characterId: string;
}) {
  const { state, setValue, flushSave } = useCampaignPlayerNotes(campaignId);

  const timerRef = useRef<any>(null);

  // simple debounce autosave
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flushSave(state.value);
    }, 600);

    return () => clearTimeout(timerRef.current);
  }, [state.value, flushSave]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Notes</div>
        <div className="text-[11px] text-gray-500">
          {state.isLoading ? "Loading…" : state.isSaving ? "Saving…" : state.lastSavedAt ? "Saved" : ""}
        </div>
      </div>

      {state.error ? (
        <div className="text-xs text-red-600 break-words">
          {state.error}
        </div>
      ) : null}

      <textarea
        className="w-full min-h-[260px] resize-y rounded-xl border p-2 text-sm"
        value={state.value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Write notes here…"
      />
    </div>
  );
}
