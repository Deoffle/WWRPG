"use client";

import { useMemo, useState } from "react";

type EntryRow = {
  id: string;
  category: string;
  reveal_level: number;
  created_at: string;
  revealed: any;
};

function safeStr(x: any) {
  return typeof x === "string" ? x : "";
}

function safeArr(x: any): string[] {
  return Array.isArray(x) ? x.filter((v) => typeof v === "string") : [];
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

export default function BestiaryClient({
  entries,
  variant = "full",
}: {
  entries: EntryRow[];
  variant?: "full" | "reference";
}) {
  const compact = variant === "reference";

  const [selected, setSelected] = useState<EntryRow | null>(null);

  // Controls (we keep logic, but hide UI in compact)
  const [q, setQ] = useState("");
  const [lvl, setLvl] = useState<"all" | "1" | "2" | "3">("all");
  const [sort, setSort] = useState<"recent" | "az">("recent");

  // Category collapse state
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const query = norm(q);

    let list = entries.slice();

    if (lvl !== "all") {
      const n = Number(lvl);
      list = list.filter((e) => e.reveal_level === n);
    }

    if (query) {
      list = list.filter((e) => {
        const r = e.revealed ?? {};
        const name = norm(safeStr(r.name));
        const tags = safeArr(r.tags).map((t) => norm(t)).join(" ");
        return name.includes(query) || tags.includes(query);
      });
    }

    if (sort === "az") {
      list.sort((a, b) => {
        const an = norm(safeStr(a.revealed?.name));
        const bn = norm(safeStr(b.revealed?.name));
        return an.localeCompare(bn);
      });
    } else {
      // recent
      list.sort((a, b) => {
        const ad = new Date(a.created_at).getTime();
        const bd = new Date(b.created_at).getTime();
        return bd - ad;
      });
    }

    return list;
  }, [entries, q, lvl, sort]);

  const grouped = useMemo(() => {
    const map = new Map<string, EntryRow[]>();
    for (const e of filtered) {
      const key = e.category || "Unsorted";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    // stable order: A–Z categories
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  // On first render / when categories change, default open all categories
  useMemo(() => {
    if (Object.keys(openCats).length) return;
    const next: Record<string, boolean> = {};
    for (const [cat] of grouped) next[cat] = true;
    setOpenCats(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped.length]);

  const sel = selected?.revealed ?? null;

  const total = entries.length;
  const shown = filtered.length;

  return (
    <div className={compact ? "space-y-3" : "space-y-6"}>
      {/* Controls (hide in compact/reference panel) */}
      {!compact && (
        <section className="border rounded-xl p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1 w-full sm:max-w-md">
              <label className="text-xs text-gray-600">Search (name or tags)</label>
              <input
                className="border rounded-md p-2 w-full"
                placeholder="e.g. dragon, undead, fire"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="text-xs text-gray-600">
                Showing <span className="font-medium">{shown}</span> of {total}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Reveal level</label>
                <select
                  className="border rounded-md p-2 w-full"
                  value={lvl}
                  onChange={(e) => setLvl(e.target.value as any)}
                >
                  <option value="all">All</option>
                  <option value="1">L1</option>
                  <option value="2">L2</option>
                  <option value="3">L3</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-600">Sort</label>
                <select
                  className="border rounded-md p-2 w-full"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                >
                  <option value="recent">Recently updated</option>
                  <option value="az">Name A–Z</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="border rounded-md px-3 py-2 text-sm"
              onClick={() => {
                const next: Record<string, boolean> = {};
                for (const [cat] of grouped) next[cat] = true;
                setOpenCats(next);
              }}
            >
              Expand all
            </button>
            <button
              type="button"
              className="border rounded-md px-3 py-2 text-sm"
              onClick={() => {
                const next: Record<string, boolean> = {};
                for (const [cat] of grouped) next[cat] = false;
                setOpenCats(next);
              }}
            >
              Collapse all
            </button>
            <button
              type="button"
              className="border rounded-md px-3 py-2 text-sm"
              onClick={() => {
                setQ("");
                setLvl("all");
                setSort("recent");
              }}
            >
              Reset filters
            </button>
          </div>
        </section>
      )}

      {/* Compact header (only in reference variant) */}
      {compact ? (
        <div className="text-xs text-gray-600">
          Showing <span className="font-medium">{shown}</span> of {total}
        </div>
      ) : null}

      {/* Categories */}
      {grouped.map(([cat, list]) => {
        const open = openCats[cat] ?? true;
        return (
          <section key={cat} className="space-y-2">
            <button
              type="button"
              className="w-full flex items-center justify-between border rounded-xl px-4 py-3"
              onClick={() => setOpenCats((p) => ({ ...p, [cat]: !open }))}
            >
              <div className="font-medium">{cat}</div>
              <div className="text-xs text-gray-600">
                {list.length} {open ? "▲" : "▼"}
              </div>
            </button>

            {open && (
              <ul
                className={
                  compact
                    ? "grid gap-2"
                    : "grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                }
              >
                {list.map((e) => {
                  const r = e.revealed ?? {};
                  const name = safeStr(r.name) || "(Unknown)";
                  const img = safeStr(r.imageUrl);

                  return (
                    <li key={e.id} className="border rounded-xl p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-gray-600">L{e.reveal_level}</div>
                      </div>

                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={name}
                          className={`w-full object-cover rounded-lg border ${
                            compact ? "h-24" : "h-40"
                          }`}
                        />
                      ) : (
                        <div
                          className={`w-full rounded-lg border flex items-center justify-center text-sm text-gray-600 ${
                            compact ? "h-24" : "h-40"
                          }`}
                        >
                          No image
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <button
                          className="underline text-sm"
                          type="button"
                          onClick={() => setSelected(e)}
                        >
                          View details
                        </button>
                        {!compact ? (
                          <div className="text-[11px] text-gray-500">
                            {new Date(e.created_at).toLocaleDateString()}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {/* Detail overlay (same behavior as full page; just add z-50 so it always shows) */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white text-black w-full max-w-3xl rounded-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xl font-semibold">{safeStr(sel?.name) || "Creature"}</div>
                <div className="text-xs text-gray-600">Reveal level {selected.reveal_level}</div>
              </div>
              <button className="border rounded-md px-3 py-2" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>

            {safeStr(sel?.imageUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={safeStr(sel.imageUrl)}
                alt={safeStr(sel?.name) || "Creature"}
                className="w-full max-h-[260px] object-contain rounded-lg border bg-white"
              />
            ) : null}

            {/* ✅ Only this part scrolls */}
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              {/* Level 1 */}
              {selected.reveal_level === 1 && (
                <p className="text-sm text-gray-700">
                  The DM has only revealed the creature’s image for now.
                </p>
              )}

              {/* Level 2 */}
              {selected.reveal_level === 2 && (
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">Type:</span> {safeStr(sel?.type) || "—"}{" "}
                    <span className="font-medium ml-3">Size:</span> {safeStr(sel?.size) || "—"}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="border rounded-lg p-3">
                      <div className="font-medium">Strengths</div>
                      <div className="text-sm text-gray-700">
                        {safeArr(sel?.strengths).length ? safeArr(sel?.strengths).join(", ") : "—"}
                      </div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="font-medium">Weaknesses</div>
                      <div className="text-sm text-gray-700">
                        {safeArr(sel?.weaknesses).length ? safeArr(sel?.weaknesses).join(", ") : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Level 3 (full) */}
              {selected.reveal_level === 3 && <FullSheetView revealed={sel} />}
            </div>

            <div className="text-xs text-gray-600">
              Updated: {new Date(selected.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FullSheetView({ revealed }: { revealed: any }) {
  const sheet = revealed?.sheet ?? {};
  const stats = sheet?.stats ?? {};
  const statKeys = ["PHY", "MEN", "MAG", "INT", "DIP", "ICY"] as const;

  // Slightly smaller text across the whole sheet
  return (
    <div className="space-y-3 text-sm">
      <div className="text-sm text-gray-800">
        <span className="font-medium">{sheet?.size || ""}</span>{" "}
        <span className="font-medium">{sheet?.type || ""}</span>{" "}
        {sheet?.alignment ? `— ${sheet.alignment}` : ""}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="border rounded-lg p-3">
          <div className="text-xs text-gray-600">AC</div>
          <div className="text-base font-semibold">{sheet?.ac ?? "—"}</div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-gray-600">HP</div>
          <div className="text-base font-semibold">{sheet?.hp ?? "—"}</div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-gray-600">Speed</div>
          <div className="text-sm font-medium">{sheet?.speed ?? "—"}</div>
        </div>
      </div>

      <div className="border rounded-lg p-3">
        <div className="font-medium mb-2">Stats</div>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-6">
          {statKeys.map((k) => (
            <div key={k} className="border rounded-md p-2 text-center">
              <div className="text-xs text-gray-600">{k}</div>
              <div className="text-base font-semibold">{stats?.[k] ?? "—"}</div>
            </div>
          ))}
        </div>
      </div>

      <TwoCol labelA="Strengths" a={sheet?.strengths} labelB="Weaknesses" b={sheet?.weaknesses} />
      <TwoCol labelA="Resistances" a={sheet?.resistances} labelB="Immunities" b={sheet?.immunities} />

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="border rounded-lg p-3">
          <div className="font-medium">Senses</div>
          <div className="text-sm text-gray-700">{sheet?.senses || "—"}</div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="font-medium">Languages</div>
          <div className="text-sm text-gray-700">{sheet?.languages || "—"}</div>
        </div>
      </div>

      {sheet?.description ? (
        <div className="border rounded-lg p-3">
          <div className="font-medium">Description</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">{sheet.description}</div>
        </div>
      ) : null}

      <BlockList title="Traits" items={sheet?.traits} />
      <BlockList title="Actions" items={sheet?.actions} />
      <BlockList title="Reactions" items={sheet?.reactions} />
      <BlockList title="Legendary actions" items={sheet?.legendary_actions} />
    </div>
  );
}

function TwoCol({ labelA, a, labelB, b }: { labelA: string; a: any; labelB: string; b: any }) {
  const arrA = Array.isArray(a) ? a : [];
  const arrB = Array.isArray(b) ? b : [];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="border rounded-lg p-3">
        <div className="font-medium">{labelA}</div>
        <div className="text-sm text-gray-700">{arrA.length ? arrA.join(", ") : "—"}</div>
      </div>
      <div className="border rounded-lg p-3">
        <div className="font-medium">{labelB}</div>
        <div className="text-sm text-gray-700">{arrB.length ? arrB.join(", ") : "—"}</div>
      </div>
    </div>
  );
}

function BlockList({ title, items }: { title: string; items: any }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="font-medium">{title}</div>
      <ul className="space-y-2">
        {list.map((it: any, idx: number) => (
          <li key={idx} className="border rounded-md p-2">
            <div className="font-medium">{typeof it?.name === "string" ? it.name : "—"}</div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {typeof it?.text === "string" ? it.text : ""}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
