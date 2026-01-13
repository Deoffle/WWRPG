"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Rarity = "common" | "rare" | "epic" | "legendary";
type EncounterType = "combat" | "exploration" | "both";

type CardUi = {
  id: string;
  name: string;
  tags: string[];
  rarity: Rarity;
  encounter_type: EncounterType;
  description: string;
  max_owned: number;
  image_path: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

const RARITY_ORDER: Record<Rarity, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  common: 3,
};

function rarityLabel(r: Rarity) {
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export default function CardsLibrary({
  campaignId,
  cards,
}: {
  campaignId: string;
  cards: CardUi[];
}) {
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [encounter, setEncounter] = useState<EncounterType | "all">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let list = cards;

    if (rarity !== "all") list = list.filter((c) => c.rarity === rarity);
    if (encounter !== "all") list = list.filter((c) => c.encounter_type === encounter);

    if (needle) {
      list = list.filter((c) => {
        const hay = `${c.name} ${c.rarity} ${c.encounter_type} ${c.tags.join(" ")}`.toLowerCase();
        return hay.includes(needle);
      });
    }

    // Legendary first, then name
    return list
      .slice()
      .sort((a, b) => {
        const ra = RARITY_ORDER[a.rarity];
        const rb = RARITY_ORDER[b.rarity];
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name);
      });
  }, [cards, q, rarity, encounter]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          className="border rounded-md p-2 sm:col-span-2"
          placeholder="Search by name/tag…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            className="border rounded-md p-2"
            value={rarity}
            onChange={(e) => setRarity(e.target.value as any)}
          >
            <option value="all">All rarities</option>
            <option value="legendary">Legendary</option>
            <option value="epic">Epic</option>
            <option value="rare">Rare</option>
            <option value="common">Common</option>
          </select>

          <select
            className="border rounded-md p-2"
            value={encounter}
            onChange={(e) => setEncounter(e.target.value as any)}
          >
            <option value="all">All types</option>
            <option value="combat">Combat</option>
            <option value="exploration">Exploration</option>
            <option value="both">Both</option>
          </select>
        </div>
      </div>

      {/* Grid thumbnails */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/app/c/${campaignId}/cards/${c.id}`}
            className="border rounded-xl p-2 hover:bg-gray-50"
          >
            {c.image_url ? (
              <img
                src={c.image_url}
                alt={c.name}
                className="w-full h-auto rounded-lg border"
                loading="lazy"
              />
            ) : (
              <div className="w-full aspect-[785/1100] rounded-lg border bg-gray-50 grid place-items-center text-xs text-gray-500">
                No image
              </div>
            )}

            <div className="mt-2 space-y-1">
              <div className="font-medium text-sm leading-tight">{c.name}</div>
              <div className="text-xs text-gray-600">
                {rarityLabel(c.rarity)} • {c.encounter_type} • max {c.max_owned}
              </div>
              {c.tags.length ? (
                <div className="text-[11px] text-gray-500 truncate">Tags: {c.tags.join(", ")}</div>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
