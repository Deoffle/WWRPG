"use client";

import { useState } from "react";
import DmQuestLogPanel from "./quest-log-panel";

export default function DmReferencePanel({ campaignId }: { campaignId: string }) {
  const [tab, setTab] = useState<"quest">("quest");

  return (
    <aside className="w-full lg:w-[420px] shrink-0">
      <div className="border rounded-2xl p-3 lg:sticky lg:top-6 max-h-[calc(100vh-3rem)] overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">Reference</div>
          <div className="text-[11px] text-gray-500">DM tools</div>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2">
          <TabButton active={tab === "quest"} onClick={() => setTab("quest")}>
            Quest log
          </TabButton>
        </div>

        <div className="mt-3 border rounded-xl p-3 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {tab === "quest" ? <DmQuestLogPanel campaignId={campaignId} /> : null}
        </div>
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: any;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-xl border text-sm ${
        active ? "bg-black text-white border-black" : "hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}
