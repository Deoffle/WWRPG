"use client";

import { useEffect, useRef } from "react";
import { useCampaignQuestLog } from "@/hooks/useCampaignQuestLog";

export default function DmQuestLogPanel({ campaignId }: { campaignId: string }) {
  const { state, setValue, flushSave } = useCampaignQuestLog(campaignId, { canEdit: true });
  const timerRef = useRef<any>(null);

  // debounce autosave (same idea as notes)
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
        <div className="text-sm font-medium">Quest log</div>
        <div className="text-[11px] text-gray-500">
          {state.isLoading ? "Loading…" : state.isSaving ? "Saving…" : state.lastSavedAt ? "Saved" : ""}
        </div>
      </div>

      {state.error ? <div className="text-xs text-red-600 break-words">{state.error}</div> : null}

      <textarea
        className="w-full min-h-[260px] resize-y rounded-xl border p-2 text-sm"
        value={state.value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Write the shared quest log here…"
      />
    </div>
  );
}
