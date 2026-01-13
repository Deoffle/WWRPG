"use client";

import { useCampaignQuestLog } from "@/hooks/useCampaignQuestLog";

export default function QuestLogPanel({ campaignId }: { campaignId: string }) {
  const { state } = useCampaignQuestLog(campaignId, { canEdit: false });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Quest log</div>
        <div className="text-[11px] text-gray-500">
          {state.isLoading ? "Loading…" : state.lastSavedAt ? "Live" : ""}
        </div>
      </div>

      {state.error ? <div className="text-xs text-red-600 break-words">{state.error}</div> : null}

      <div className="w-full min-h-[260px] resize-y rounded-xl border p-2 text-sm">
        {state.value?.trim() ? state.value : "No quest log yet."}
      </div>
    </div>
  );
}
