"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DeckType = "combat" | "exploration";

type Card = {
  id: string;
  name: string;
  tags: string[];
  rarity: "common" | "rare" | "epic" | "legendary";
  encounter_type: "combat" | "exploration" | "both";
  description: string;
  max_owned: number;
  image_url: string | null;
};

type Entry = { card: Card; quantity: number };

function rarityRank(r: Card["rarity"]) {
  // legendary first
  if (r === "legendary") return 0;
  if (r === "epic") return 1;
  if (r === "rare") return 2;
  return 3; // common
}

export default function DeckEditor({
  campaignId,
  deckId,
  deckType,
  cards,
  initialEntries,
}: {
  campaignId: string;
  deckId: string;
  deckType: DeckType;
  cards: Card[];
  initialEntries: Entry[];
}) {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [openCard, setOpenCard] = useState<null | { name: string; image_url: string }>(null);

  function openImage(name: string, image_url: string | null) {
    if (!image_url) return;
    setOpenCard({ name, image_url });
  }

  // close modal on ESC
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenCard(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);



  const entryMap = useMemo(() => {
    const m = new Map<string, Entry>();
    entries.forEach((e) => m.set(e.card.id, e));
    return m;
  }, [entries]);

  const filteredCards = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return cards
      .filter((c) => c.encounter_type === "both" || c.encounter_type === deckType)
      .filter((c) => {
        if (!needle) return true;
        const hay = `${c.name} ${c.rarity} ${c.encounter_type} ${(c.tags ?? []).join(" ")}`.toLowerCase();
        return hay.includes(needle);
      })
      .slice()
      .sort((a, b) => {
        const rr = rarityRank(a.rarity) - rarityRank(b.rarity);
        if (rr !== 0) return rr;
        return a.name.localeCompare(b.name);
      });
  }, [cards, q, deckType]);

  async function setQty(card: Card, quantity: number) {
    setErr(null);
    setBusy(card.id);

    const res = await fetch("/api/decks/set-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, deckId, cardId: card.id, quantity }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to update deck.");
      return;
    }

    setEntries((prev) => {
      const next = prev.filter((e) => e.card.id !== card.id);
      if (quantity > 0) next.unshift({ card, quantity });
      return next;
    });

    router.refresh();
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Library */}
        <section className="border rounded-xl p-4 space-y-3">
          <div>
            <h2 className="font-medium">Card library</h2>
            <p className="text-xs text-gray-600">
              Showing {deckType} + both. Quantity is capped by each card’s{" "}
              <span className="font-medium">Max owned</span>.
            </p>
          </div>

          <input
            className="border rounded-md p-2 w-full"
            placeholder="Search by name/tag/rarity…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {err && <p className="text-sm text-red-600">{err}</p>}

          <ul className="space-y-2 max-h-[520px] overflow-auto pr-1">
            {filteredCards.map((c) => {
              const existing = entryMap.get(c.id)?.quantity ?? 0;
              const maxOwned = Number.isFinite(c.max_owned) ? c.max_owned : 1;

              const atLimit = existing >= maxOwned;

              const canAdd = !atLimit && busy !== c.id;
              const canRemove = existing > 0 && busy !== c.id;

              return (
                <li key={c.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      {c.image_url ? (
                        <button
                          type="button"
                          onClick={() => openImage(c.name, c.image_url)}
                          className="shrink-0"
                          title="View larger"
                        >
                          <img
                            src={c.image_url}
                            alt={c.name}
                            className="w-14 h-auto rounded-md border hover:opacity-90"
                            loading="lazy"
                          />
                        </button>
                      ) : (
                        <div className="w-14 h-[80px] rounded-md border bg-gray-50 shrink-0" />
                      )}

                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-sm text-gray-600">
                          {c.rarity} • {c.encounter_type} • max owned: {maxOwned}
                        </div>
                        {c.tags?.length ? (
                          <div className="text-xs text-gray-500 mt-1">
                            Tags: {c.tags.join(", ")}
                          </div>
                        ) : null}
                        {atLimit ? (
                          <div className="text-xs text-gray-500 mt-1">
                            At max owned for this card.
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="border rounded-md px-2"
                        disabled={!canRemove}
                        onClick={() => setQty(c, Math.max(0, existing - 1))}
                        type="button"
                      >
                        −
                      </button>
                      <div className="w-8 text-center">{existing}</div>
                      <button
                        className="border rounded-md px-2"
                        disabled={!canAdd}
                        onClick={() => setQty(c, existing + 1)}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Deck */}
        <section className="border rounded-xl p-4 space-y-3">
          <div>
            <h2 className="font-medium">Deck contents</h2>
            <p className="text-xs text-gray-600">
              Cards currently pushed into this deck.
            </p>
          </div>

          {entries.length === 0 ? (
            <p className="text-sm text-gray-600">No cards in this deck yet.</p>
          ) : (
            <ul className="space-y-2">
              {entries
                .slice()
                .sort(
                  (a, b) =>
                    rarityRank(a.card.rarity) - rarityRank(b.card.rarity) ||
                    a.card.name.localeCompare(b.card.name)
                )
                .map((e) => (
                  <li
                    key={e.card.id}
                    className="border rounded-lg p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      {e.card.image_url ? (
                        <button
                          type="button"
                          onClick={() => openImage(e.card.name, e.card.image_url)}
                          className="shrink-0"
                          title="View larger"
                        >
                          <img
                            src={e.card.image_url}
                            alt={e.card.name}
                            className="w-10 h-auto rounded-md border hover:opacity-90"
                            loading="lazy"
                          />
                        </button>
                      ) : (
                        <div className="w-10 h-[56px] rounded-md border bg-gray-50 shrink-0" />
                      )}

                      <div>
                        <div className="font-medium">
                          {e.card.name}{" "}
                          <span className="text-gray-500">× {e.quantity}</span>
                        </div>
                        <div className="text-sm text-gray-600">{e.card.rarity}</div>
                      </div>
                    </div>

                    <button
                      className="border rounded-md px-3 py-1"
                      disabled={busy === e.card.id}
                      onClick={() => setQty(e.card, 0)}
                      type="button"
                    >
                      Remove
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>

      {/* Modal */}
      {openCard ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onMouseDown={() => setOpenCard(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-w-[420px] w-full"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <img
              src={openCard.image_url}
              alt={openCard.name}
              className="w-full h-auto rounded-xl border bg-white"
            />
            <div className="mt-2 text-center text-sm text-white/90">
              {openCard.name} <span className="text-white/60">(click outside to close)</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
