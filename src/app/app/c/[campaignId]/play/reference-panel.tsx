"use client";

import { useState } from "react";
import BestiaryClient from "../bestiary/bestiary-client";
import CharacterSheetReference from "./character-sheet-reference";
import NotesPanel from "./notes-panel";
import QuestLogPanel from "./quest-log-panel";

type EntryRow = {
  id: string;
  category: string;
  reveal_level: number;
  created_at: string;
  revealed: any;
};

export default function ReferencePanel({
  campaignId,
  characterId,
  characterName,
  activeEncounterId,
  bestiaryEntries,
  characterSheetRaw,
  legacyReportCardRaw,
  itemsRaw,
}: {
  campaignId: string;
  characterId: string;
  characterName: string;
  activeEncounterId: string | null;
  bestiaryEntries: EntryRow[];
  characterSheetRaw: any;
  legacyReportCardRaw: any;
  itemsRaw: any;
}) {
  const [tab, setTab] = useState<"bestiary" | "sheet" | "notes" | "quest">("bestiary");

  return (
    <aside className="w-full lg:w-[420px] shrink-0">
      <div className="border rounded-2xl p-3 lg:sticky lg:top-6 max-h-[calc(100vh-3rem)] overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">Reference</div>
          <div className="text-[11px] text-gray-500">Always visible</div>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-2">
          <TabButton active={tab === "bestiary"} onClick={() => setTab("bestiary")}>Bestiary</TabButton>
          <TabButton active={tab === "sheet"} onClick={() => setTab("sheet")}>Character</TabButton>
          <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>Notes</TabButton>
          <TabButton active={tab === "quest"} onClick={() => setTab("quest")}>Quest</TabButton>
        </div>

        <div className="mt-3 border rounded-xl p-3 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {tab === "bestiary" ? (
            bestiaryEntries.length ? (
              <BestiaryClient entries={bestiaryEntries as any} variant="reference" />
            ) : (
              <div className="text-sm text-gray-600">Nothing revealed to you yet.</div>
            )
          ) : null}

          {tab === "sheet" ? (
            characterSheetRaw ? (
              <CharacterSheetReference
                characterName={characterName}
                sheetRaw={characterSheetRaw}
                legacyReportCard={legacyReportCardRaw}
                itemsRaw={itemsRaw}
              />
            ) : (
              <div className="text-sm text-gray-600">No character sheet found.</div>
            )
          ) : null}

          {tab === "notes" ? (
            <NotesPanel
              campaignId={campaignId}
              encounterId={activeEncounterId}
              characterId={characterId}
            />
          ) : null}

          {tab === "quest" ? <QuestLogPanel campaignId={campaignId} /> : null}
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
