"use client";

import { useMemo, useState } from "react";

type DeckType = "combat" | "exploration";
type EncounterType = "combat" | "exploration" | "both";
type Rarity = "common" | "rare" | "epic" | "legendary";

type Card = {
  id: string;
  name: string;
  encounter_type: EncounterType;
  rarity: Rarity;
  description: string;
  tags: string[] | null;
  image_path: string | null;
  image_url: string | null;
  max_owned: number;
  created_at: string;
};

type Entry = { card: Card; quantity: number };

const RARITY_ORDER: Record<Rarity, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  common: 3,
};

export default function DeckViewer({
  deckType,
  entries,
}: {
  deckType: DeckType;
  entries: Entry[];
}) {
  const [preview, setPreview] = useState<Card | null>(null);

  const cards = useMemo(() => {
    // show each unique card once (even if quantity > 1)
    return entries
      .slice()
      .filter((e) => e.quantity > 0)
      .map((e) => e.card)
      .sort((a, b) => {
        const ra = RARITY_ORDER[a.rarity];
        const rb = RARITY_ORDER[b.rarity];
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name);
      });
  }, [entries]);

  return (
    <div className="space-y-3">
      <div className="border rounded-xl p-4">
        <h2 className="font-medium">Your {deckType} deck</h2>
        <p className="text-xs text-gray-600">
          Click a card to view it larger.
        </p>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-gray-600">No cards available yet.</p>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {cards.map((c) => (
            <button
              key={c.id}
              type="button"
              className="text-left"
              onClick={() => setPreview(c)}
            >
              {c.image_url ? (
                <img
                  src={c.image_url}
                  alt={c.name}
                  className="w-full h-auto rounded-lg border hover:opacity-95"
                  loading="lazy"
                />
              ) : (
                <div className="w-full aspect-[785/1100] rounded-lg border bg-gray-50 grid place-items-center text-xs text-gray-500">
                  No image
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {preview ? (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-white rounded-xl p-3 max-w-[900px] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium">{preview.name}</div>
              <button
                className="border rounded-md px-3 py-1"
                type="button"
                onClick={() => setPreview(null)}
              >
                Close
              </button>
            </div>

            <div className="mt-3 grid place-items-center">
              {preview.image_url ? (
                <img
                  src={preview.image_url}
                  alt={preview.name}
                  className="max-h-[82vh] w-auto rounded-lg border"
                />
              ) : (
                <div className="w-[360px] aspect-[785/1100] rounded-lg border bg-gray-50 grid place-items-center text-sm text-gray-500">
                  No image
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
