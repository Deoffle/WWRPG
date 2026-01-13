"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import ReferencePanel from "./reference-panel";

type CampaignStateRow = {
  campaign_id: string;
  mode: string | null;
  active_encounter_id: string | null;
};

type EncounterRow = {
  id: string;
  status: string | null;
  round_number: number | null;
  turn_index: number | null;
};

type CombatantRow = {
  id: string;
  kind: string;
  name: string | null;
  character_id: string | null;
  order_index: number | null;
  is_hidden: boolean | null;
  is_defeated: boolean | null;
  status_public: any;

  death_saves_successes: number | null;
  death_saves_failures: number | null;

  hp_current: number | null;
  hp_max: number | null;
};



type CombatDeckStateRow = {
  id: string;
  campaign_id: string;
  encounter_id: string;
  character_id: string;
  deck_id: string;
  hand_limit: number | null;
  draw_pile: string[] | null;
  hand: string[] | null;
  discard_pile: string[] | null;
  updated_at: string | null;
};

type BestiaryEntryRow = {
  id: string;
  category: string;
  reveal_level: number;
  created_at: string;
  revealed: any;
};

function readStatuses(raw: any): { label: string; remaining: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (typeof x === "string") return { label: x, remaining: 1 };
      if (x && typeof x === "object") {
        const label = String(x.label ?? "").trim();
        const remaining = Number(x.remaining);
        if (!label) return null;
        return { label, remaining: Number.isFinite(remaining) ? remaining : 1 };
      }
      return null;
    })
    .filter(Boolean) as any;
}

function safeStructured(x: any) {
  if (x && typeof x === "object") return x;
  if (typeof x === "string") {
    try {
      const parsed = JSON.parse(x);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function extractHpFromSheet(sheet: any): { current: number | null; max: number | null } {
  const cs = sheet?.characterSheet ?? {};
  const hp = cs?.hp ?? {};
  const derived = cs?.derived ?? {};

  const curRaw = hp?.current ?? cs?.hpCurrent ?? cs?.currentHp ?? null;
  const maxRaw = derived?.hpMaxOverride ?? derived?.hpCurrent ?? hp?.max ?? cs?.hpMax ?? cs?.maxHp ?? null;

  const cur = Number.isFinite(Number(curRaw)) ? Number(curRaw) : null;
  const max = Number.isFinite(Number(maxRaw)) ? Number(maxRaw) : null;

  return { current: cur, max };
}

export default function PlayClient({
  campaignId,
  characterId,
  characterName,
}: {
  campaignId: string;
  characterId: string;
  characterName: string;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const activeEncounterIdRef = useRef<string | null>(null);

  const refreshQueuedRef = useRef(false);
  const lastRealtimeEventAtRef = useRef<number>(Date.now());

  const myHpDirtyRef = useRef(false);

  // NEW: prevents loadAll() from overwriting recently-saved HP before DB catches up
  const pendingHpRef = useRef<{
    cur: number;
    max: number | null;
    until: number; // timestamp ms
  } | null>(null);

  function queueRefreshAll() {
    lastRealtimeEventAtRef.current = Date.now();
    if (refreshQueuedRef.current) return;

    refreshQueuedRef.current = true;
    setTimeout(async () => {
      refreshQueuedRef.current = false;
      await loadAll({ silent: true });
    }, 150);
  }


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [campaignState, setCampaignState] = useState<CampaignStateRow | null>(null);
  const [encounter, setEncounter] = useState<EncounterRow | null>(null);
  const [combatants, setCombatants] = useState<CombatantRow[]>([]);

  const [deckState, setDeckState] = useState<CombatDeckStateRow | null>(null);

  const [cardsById, setCardsById] = useState<Record<string, string>>({});
  const [cardImageById, setCardImageById] = useState<Record<string, string | null>>({});

  const [explorationHand, setExplorationHand] = useState<{ card_id: string; qty: number }[]>([]);
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);

  const [showPile, setShowPile] = useState<null | "draw" | "discard">(null);

  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<any>(null);
  const [openCardLoading, setOpenCardLoading] = useState(false);
  const [openCardError, setOpenCardError] = useState<string | null>(null);

  const [myCombatantId, setMyCombatantId] = useState<string | null>(null);
  const [myHpCurrent, setMyHpCurrent] = useState<number | null>(null);
  const [myHpMax, setMyHpMax] = useState<number | null>(null);
  const [myHpDraft, setMyHpDraft] = useState<string>("");


  type LogRow = {
    id: string;
    created_at: string;
    kind: string | null;
    visibility: string | null;
    payload: any;
  };
  const [logRows, setLogRows] = useState<LogRow[]>([]);

  // Reference panel data
  const [bestiaryEntries, setBestiaryEntries] = useState<BestiaryEntryRow[]>([]);
  const [characterSheetRaw, setCharacterSheetRaw] = useState<any>(null);
  const [legacyReportCardRaw, setLegacyReportCardRaw] = useState<any>(null);
  const [itemsRaw, setItemsRaw] = useState<any[]>([]);

  const activeEncounterId = campaignState?.active_encounter_id ?? null;
  activeEncounterIdRef.current = activeEncounterId;

  const sortedHand = useMemo(() => {
    const h = [...(deckState?.hand ?? [])];
    h.sort((a, b) => (cardsById[a] ?? "").localeCompare(cardsById[b] ?? ""));
    return h;
  }, [deckState?.hand, cardsById]);

  const selectedCardId =
    selectedHandIndex === null ? null : (sortedHand[selectedHandIndex] ?? null);

  async function moveCardToDiscard(cardId: string) {
    setError(null);
    if (!deckState?.id) {
      setError("No combat deck for this encounter.");
      return;
    }

    const res = await fetch("/api/encounter/play/hand/to-discard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckStateId: deckState.id, cardId }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error ?? "Failed to move card");
      return;
    }

    setSelectedHandIndex(null);
    await loadAll();
  }

  async function logCardAction(action: "play" | "discard", cardId: string) {
    if (!activeEncounterId) return;
    const cardName = cardsById[cardId] ?? "";

    const res = await fetch("/api/encounter/play/log-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        encounterId: activeEncounterId,
        characterId,
        action,
        cardId,
        cardName,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) setError(json?.error ?? "Failed to write log");
  }

  async function drawToLimit() {
    setError(null);

    if (!deckState?.id) {
      setError("No combat deck for this encounter.");
      return;
    }

    const res = await fetch("/api/encounter/play/draw-to-limit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deckStateId: deckState.id }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error ?? "Failed to draw");
      return;
    }

    await loadAll();
  }

  async function saveMyHpCurrent() {
    setError(null);
    if (!activeEncounterId) return;

    const res = await fetch("/api/encounter/play/set-hp-current", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        encounterId: activeEncounterId,
        characterId,
        hpCurrent: myHpDraft,
      }),
    });

    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error ?? "Failed to update HP");
      return;
    }

    const cur = Number.isFinite(Number(json?.hpCurrent)) ? Math.trunc(Number(json.hpCurrent)) : null;
    const max = Number.isFinite(Number(json?.hpMax)) ? Math.trunc(Number(json.hpMax)) : null;

    // ✅ Optimistically apply to your local "you" HP state
    setMyHpCurrent(cur);
    if (max !== null) setMyHpMax(max);

    myHpDirtyRef.current = false;
    setMyHpDraft(cur === null ? "" : String(cur));

    // ✅ IMPORTANT: update the combatants list so the turn order uses the new value immediately
    if (myCombatantId && cur !== null) {
      setCombatants((prev) =>
        prev.map((c) =>
          c.id === myCombatantId
            ? { ...c, hp_current: cur, hp_max: max ?? c.hp_max }
            : c
        )
      );
    }

    // ✅ Don't hard reload immediately — let realtime catch up
    setTimeout(() => queueRefreshAll(), 400);
  }


  async function loadLogOnly(encounterId: string) {
    const { data: logs, error: logErr } = await supabase
      .from("encounter_log")
      .select("id, created_at, kind, visibility, payload")
      .eq("campaign_id", campaignId)
      .eq("encounter_id", encounterId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!logErr) setLogRows(logs ?? []);
  }

  async function upsertCardMetaFromRows(cardRows: any[]) {
    const nameMap: Record<string, string> = {};
    const imgMap: Record<string, string | null> = {};

    for (const r of cardRows ?? []) {
      const id = String(r.id);
      nameMap[id] = r.name ?? "(unnamed)";

      const structured = safeStructured(r.structured);

      // ✅ Prefer the real column, fallback to structured
      const directPath = typeof r.image_path === "string" ? r.image_path : null;
      const structuredPath = typeof structured?.image_path === "string" ? structured.image_path : null;
      const imagePath = directPath ?? structuredPath;
      if (imagePath) {
        const { data } = supabase.storage.from("card-images").getPublicUrl(imagePath);
        imgMap[id] = data?.publicUrl ?? null;
      } else {
        imgMap[id] = null;
      }
    }

    setCardsById((prev) => ({ ...prev, ...nameMap }));
    setCardImageById((prev) => ({ ...prev, ...imgMap }));
  }

  async function openCardModal(cardId: string) {
    setOpenCardId(cardId);
    setOpenCard(null);
    setOpenCardError(null);
    setOpenCardLoading(true);

    const { data, error } = await supabase
      .from("cards")
      .select("id,name,rules_text,image_path,structured")
      .eq("id", cardId)
      .maybeSingle();

    if (error || !data) {
      setOpenCardError(error?.message ?? "Card not found");
      setOpenCardLoading(false);
      return;
    }

    // Build image url (prefer image_path column; fallback structured.image_path)
    const structured = safeStructured((data as any).structured);
    const directPath = typeof (data as any).image_path === "string" ? (data as any).image_path : null;
    const structuredPath = typeof structured?.image_path === "string" ? structured.image_path : null;
    const imagePath = directPath ?? structuredPath;

    const imageUrl = imagePath
      ? supabase.storage.from("card-images").getPublicUrl(imagePath).data?.publicUrl ?? null
      : null;

    setOpenCard({ ...data, imageUrl });
    setOpenCardLoading(false);
  }


  async function loadExplorationDeck() {
    const { data: deck, error: deckErr } = await supabase
      .from("decks")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("character_id", characterId)
      .eq("deck_type", "exploration")
      .maybeSingle();

    if (deckErr) {
      setError(deckErr.message);
      return;
    }

    if (!deck?.id) {
      setExplorationHand([]);
      return;
    }

    const { data: dcs, error: dcErr } = await supabase
      .from("deck_cards")
      .select("card_id, quantity")
      .eq("deck_id", deck.id);

    if (dcErr) {
      setError(dcErr.message);
      return;
    }

    const rows = (dcs ?? [])
      .map((r: any) => ({ card_id: r.card_id as string, qty: Number(r.quantity ?? 0) }))
      .filter((r) => r.card_id && r.qty > 0);

    setExplorationHand(rows);

    const ids = rows.map((r) => r.card_id);
    if (ids.length > 0) {
      const { data: cardRows, error: cardErr } = await supabase
        .from("cards")
        .select("id,name,structured,image_path")
        .in("id", ids);


      if (cardErr) {
        setError(cardErr.message);
        return;
      }

      await upsertCardMetaFromRows(cardRows ?? []);
    }
  }

  async function loadReferenceData() {
    // Bestiary (player-owned, per-character)
    const { data: entries, error: beErr } = await supabase
      .from("bestiary_entries")
      .select("id,category,reveal_level,created_at,revealed")
      .eq("campaign_id", campaignId)
      .eq("character_id", characterId)
      .order("category", { ascending: true })
      .order("created_at", { ascending: false });

    if (beErr) setError(beErr.message);
    setBestiaryEntries((entries ?? []) as any);

    // Character sheet + items are stored in characters.sheet json
    const { data: ch, error: chErr } = await supabase
      .from("characters")
      .select("sheet")
      .eq("id", characterId)
      .eq("campaign_id", campaignId)
      .single();

    if (chErr) {
      setError(chErr.message);
      return;
    }

    const sheet = (ch?.sheet ?? {}) as any;
    const hp = extractHpFromSheet(sheet);
    setMyHpCurrent(hp.current);
    setMyHpMax(hp.max);

    // Initialize the input so it doesn't start empty
    setMyHpDraft(hp.current === null ? "" : String(hp.current));
    const characterSheet = sheet.characterSheet ?? null;
    const legacyReportCard = sheet.reportCard ?? null;
    const items = Array.isArray(sheet.items) ? sheet.items : [];

    setCharacterSheetRaw(characterSheet);
    setLegacyReportCardRaw(legacyReportCard);
    setItemsRaw(items);
  }

  async function loadAll(opts?: { silent?: boolean }) {
    const silent = !!opts?.silent;

    if (!silent) setLoading(true);
    setError(null);

    const { data: state, error: stateErr } = await supabase
      .from("campaign_state")
      .select("campaign_id, mode, active_encounter_id")
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (stateErr) {
      setError(stateErr.message);
      if (!silent) setLoading(false);
      return;
    }

    setCampaignState(
      state ?? { campaign_id: campaignId, mode: "exploration", active_encounter_id: null }
    );

    const mode = (state?.mode ?? "exploration") as string;

    if (mode === "combat" && state?.active_encounter_id) {
      const encId = state.active_encounter_id;

      const { data: enc, error: encErr } = await supabase
        .from("encounters")
        .select("id, status, round_number, turn_index")
        .eq("id", encId)
        .single();

      if (encErr) {
        setError(encErr.message);
        if (!silent) setLoading(false);
        return;
      }
      setEncounter(enc);

      const { data: logs, error: logErr } = await supabase
        .from("encounter_log")
        .select("id, created_at, kind, visibility, payload")
        .eq("campaign_id", campaignId)
        .eq("encounter_id", encId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (logErr) {
        setError(logErr.message);
        if (!silent) setLoading(false);
        return;
      }
      setLogRows(logs ?? []);

      const { data: comb, error: combErr } = await supabase
        .from("encounter_combatants")
        .select("id, kind, name, character_id, order_index, is_hidden, is_defeated, status_public, death_saves_successes, death_saves_failures, hp_current, hp_max")
        .eq("campaign_id", campaignId)
        .eq("encounter_id", encId)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });

      if (combErr) {
        setError(combErr.message);
        if (!silent) setLoading(false);
        return;
      }
      setCombatants(comb ?? []);

      const myC = (comb ?? []).find((x) => x.kind === "character" && x.character_id === characterId);
      const myCid = myC?.id ?? null;
      setMyCombatantId(myCid);

      // ✅ Use PUBLIC combatants row as the main source (players can always see this)
      const curPublic = typeof myC?.hp_current === "number" ? myC.hp_current : null;
      const maxPublic = typeof myC?.hp_max === "number" ? myC.hp_max : null;

      // ✅ Use PUBLIC combatants row as main source
      let finalCur = typeof myC?.hp_current === "number" ? myC.hp_current : null;
      let finalMax = typeof myC?.hp_max === "number" ? myC.hp_max : null;

      // ✅ If we recently saved HP, don't let loadAll overwrite it until DB catches up
      const pending = pendingHpRef.current;
      if (pending && Date.now() < pending.until) {
        // if DB hasn't caught up yet, prefer pending
        if (finalCur !== pending.cur) finalCur = pending.cur;
        if (pending.max !== null && finalMax !== pending.max) finalMax = pending.max;
      } else if (pending) {
        // grace window over
        pendingHpRef.current = null;
      }

      // If DB has caught up, clear pending immediately
      if (pending && finalCur === pending.cur) {
        pendingHpRef.current = null;
      }

      setMyHpCurrent(finalCur);
      setMyHpMax(finalMax);

      if (!myHpDirtyRef.current) {
        setMyHpDraft(finalCur === null ? "" : String(finalCur));
      }

      const { data: ds, error: dsErr } = await supabase
        .from("combat_deck_state")
        .select("id,campaign_id,encounter_id,character_id,deck_id,hand_limit,draw_pile,hand,discard_pile,updated_at")
        .eq("campaign_id", campaignId)
        .eq("encounter_id", encId)
        .eq("character_id", characterId)
        .maybeSingle();

      if (dsErr) {
        setError(dsErr.message);
        if (!silent) setLoading(false);
        return;
      }

      setDeckState(ds ?? null);

      const ids = Array.from(
        new Set([
          ...((ds?.draw_pile ?? []) as string[]),
          ...((ds?.hand ?? []) as string[]),
          ...((ds?.discard_pile ?? []) as string[]),
        ])
      );

      if (ids.length > 0) {
        const { data: cardRows, error: cardErr } = await supabase
          .from("cards")
          .select("id,name,structured,image_path")
          .in("id", ids);


        if (cardErr) {
          setError(cardErr.message);
          if (!silent) setLoading(false);
          return;
        }

        await upsertCardMetaFromRows(cardRows ?? []);
      }

      setExplorationHand([]);
      if (!silent) setLoading(false);
      return;
    }

    // Exploration mode
    setEncounter(null);
    setLogRows([]);
    setCombatants([]);
    setDeckState(null);

    await loadExplorationDeck();
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    loadAll();
    loadReferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;

    const channelStatusRef = { current: "INIT" as string };

    const channel = supabase
      .channel(`play-${campaignId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_state", filter: `campaign_id=eq.${campaignId}` },
        () => queueRefreshAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "encounters", filter: `campaign_id=eq.${campaignId}` },
        () => queueRefreshAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "encounter_combatants", filter: `campaign_id=eq.${campaignId}` },
        () => queueRefreshAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "combat_deck_state", filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          const rowCharId =
            (payload.new as any)?.character_id ?? (payload.old as any)?.character_id ?? null;
          if (rowCharId === characterId) queueRefreshAll();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "encounter_log", filter: `campaign_id=eq.${campaignId}` },
        () => {
          const encId = activeEncounterIdRef.current;
          if (encId) loadLogOnly(encId);
        }
      )
      .subscribe((status) => {
        channelStatusRef.current = status;
      });

    // DM-style safety poll: keep log fresh without "loading" flicker.
    // If realtime isn't subscribed, fall back to occasional silent full refresh.
    const t = setInterval(() => {
      const msSince = Date.now() - lastRealtimeEventAtRef.current;

      // if we haven't heard anything in a bit, do a silent refresh
      if (msSince > 4000) queueRefreshAll();

      const encId = activeEncounterIdRef.current;
      if (encId) loadLogOnly(encId);
    }, 2000);

    return () => {
      clearInterval(t);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, characterId]);



  const activeCombatants = combatants.filter((c) => !c.is_defeated);
  const currentTurnIndex = encounter?.turn_index ?? 0;
  const currentCombatant = activeCombatants[currentTurnIndex];
  const isYourTurn = currentCombatant?.character_id === characterId;

  const mode = campaignState?.mode ?? "exploration";

  const drawCount = deckState?.draw_pile?.length ?? 0;
  const handCount = deckState?.hand?.length ?? 0;
  const discardCount = deckState?.discard_pile?.length ?? 0;
  const handLimit = deckState?.hand_limit ?? 4;

  const explorationSorted = [...explorationHand].sort((a, b) =>
    (cardsById[a.card_id] ?? "").localeCompare(cardsById[b.card_id] ?? "")
  );

  return (
    <main className="p-6 pb-56">
      {/* Top header */}
      <header className="space-y-2 max-w-6xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Play</h1>
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-800">You:</span> {characterName}
              {" · "}
              <span className="font-medium text-gray-800">Mode:</span> {campaignState?.mode ?? "unknown"}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link className="underline text-sm" href={`/app/c/${campaignId}`}>
              ← Back to campaign
            </Link>
            <button
              onClick={() => {
                loadAll();
                loadReferenceData();
              }}
              disabled={loading}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
            >
              Reload
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">Error: {error}</p> : null}
      </header>

      {/* Main content: left encounter + fixed-width reference panel */}
      <div className="max-w-6xl mt-6 lg:flex gap-4">
        <section className="flex-1 border rounded-2xl p-4 space-y-4 min-w-0">
          <h2 className="font-medium">Encounter</h2>

          {!activeEncounterId ? (
            <p className="text-sm text-gray-600">No active encounter.</p>
          ) : (
            <>
              <div className="flex gap-4 flex-wrap text-sm text-gray-600">
                <div>
                  <span className="font-medium text-gray-800">Round:</span> {encounter?.round_number ?? "?"}
                </div>
                <div>
                  <span className="font-medium text-gray-800">Turn:</span>{" "}
                  {activeCombatants.length === 0 ? "?" : `${currentTurnIndex + 1} / ${activeCombatants.length}`}
                </div>
                <div>
                  <span className="font-medium text-gray-800">Status:</span> {encounter?.status ?? "?"}
                </div>
              </div>

              {campaignState?.mode === "combat" ? (
                <div className={`border rounded-xl p-3 ${isYourTurn ? "bg-green-50 border-green-300" : ""}`}>
                  <div className="font-medium">{isYourTurn ? "✅ It’s your turn!" : "Waiting..."}</div>
                  <div className="text-sm text-gray-600">Current: {currentCombatant?.name ?? "(unknown)"}</div>
                </div>
              ) : null}

              <div className="space-y-2">
                <h3 className="font-medium">Turn order</h3>
                <ul className="space-y-2">
                  {combatants.map((c) => {
                    const activeIndex = activeCombatants.findIndex((x) => x.id === c.id);
                    const isCurrent = activeIndex === currentTurnIndex && activeIndex !== -1;

                    return (
                      <li
                        key={c.id}
                        className={`border rounded-xl p-3 ${isCurrent ? "bg-yellow-50 border-yellow-300" : ""} ${
                          c.is_defeated ? "opacity-60" : ""
                        }`}
                      >
                        <div className="font-medium">
                          {isCurrent ? "⭐ " : ""}
                          {c.name ?? "(no name)"}
                          {c.character_id === characterId ? " (you)" : ""}
                        </div>

                        <div className="text-xs text-gray-500">
                          kind: {c.kind} · defeated: {String(c.is_defeated)}
                        </div>

                        {/* Death saves (characters only) */}
                        {c.kind === "character" ? (
                          <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-gray-600">
                            <span className="font-medium text-gray-700">Death saves:</span>
                            <span className="border rounded-full px-2 py-1">
                              ✅ {c.death_saves_successes ?? 0}/3
                            </span>
                            <span className="border rounded-full px-2 py-1">
                              ❌ {c.death_saves_failures ?? 0}/3
                            </span>
                          </div>
                        ) : null}


                        {/* HP (characters only). Editable only for you */}
                        {c.kind === "character" ? (
                          c.character_id === characterId ? (
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-500">HP:</span>

                              <input
                                className="px-2 py-1 border rounded-md w-20"
                                inputMode="numeric"
                                value={myHpDraft}
                                onChange={(e) => {
                                  myHpDirtyRef.current = true;
                                  setMyHpDraft(e.target.value);
                                }}
                                placeholder={myHpCurrent === null ? "?" : String(myHpCurrent)}
                              />

                              <span className="text-xs text-gray-500">/ {myHpMax ?? "?"}</span>

                              <button
                                type="button"
                                onClick={saveMyHpCurrent}
                                disabled={loading || !myCombatantId}
                                className="px-3 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 text-sm"
                              >
                                Save HP
                              </button>
                            </div>
                          ) : (
                            // For other characters: show nothing (or you can show "HP: ?" if you want)
                            null
                          )
                        ) : null}


                        {/* Status pills (keep your existing block) */}
                        <div className="flex gap-2 flex-wrap mt-2">
                          {readStatuses(c.status_public).map((s) => (
                            <span key={s.label} className="border rounded-full px-3 py-1 text-sm">
                              {s.label} ({s.remaining})
                            </span>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <section className="border rounded-2xl p-4 space-y-2">
                <h3 className="font-medium">Encounter log</h3>

                {logRows.length === 0 ? (
                  <div className="text-sm text-gray-500">No log entries yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {logRows.map((r) => {
                      const p = (r.payload ?? {}) as any;

                      let line = "";
                      if (r.kind === "note") {
                        line = String((p.text ?? "")).trim() || "(note)";
                      } else if (r.kind === "card") {
                        const action = p.action;
                        const cardName = p.card_name ?? "(card)";
                        const who = p.character_name ?? "Someone";
                        line = `${who} ${action === "play" ? "played" : "discarded"} ${cardName}`;
                      } else {
                        line = `${r.kind ?? "log"} entry`;
                      }

                      return (
                        <li key={r.id} className="text-sm">
                          {r.kind === "card" ? (
                            <div>
                              <span>{p.character_name ?? "Someone"} </span>
                              <span>{p.action === "play" ? "played" : "discarded"} </span>
                              <button
                                type="button"
                                className="underline"
                                onClick={() => {
                                  const cid = typeof p.card_id === "string" ? p.card_id : "";
                                  if (cid) openCardModal(cid);
                                }}
                              >
                                {p.card_name ?? "(card)"}
                              </button>

                              <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
                            </div>
                          ) : (
                            <div>
                              <div>{line}</div>
                              <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </section>

        <ReferencePanel
          campaignId={campaignId}
          characterId={characterId}
          characterName={characterName}
          activeEncounterId={activeEncounterId}
          bestiaryEntries={bestiaryEntries}
          characterSheetRaw={characterSheetRaw}
          legacyReportCardRaw={legacyReportCardRaw}
          itemsRaw={itemsRaw}
        />
      </div>

      {/* Bottom fixed hand bar (NEW VISUALS) */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto p-3 space-y-2">
          {mode === "combat" ? (
            <>
              <div className="flex items-end gap-3">
                {/* Discard (left) */}
                <button
                  type="button"
                  onClick={() => setShowPile(showPile === "discard" ? null : "discard")}
                  className="w-[140px] border rounded-2xl p-3 hover:bg-gray-50 text-left shrink-0"
                >
                  <div className="text-xs text-gray-600">Discard</div>
                  <div className="font-semibold">{discardCount}</div>
                  <div className="text-[11px] text-gray-500">Tap to view</div>
                </button>

                {/* Hand (center) */}
                <div className="flex-1 min-w-0 border rounded-2xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-600">Hand ({handCount} / {handLimit})</div>
                    <button
                      onClick={drawToLimit}
                      disabled={loading || !deckState}
                      className="px-3 py-2 rounded-xl border hover:bg-gray-50 disabled:opacity-50 text-sm"
                      title="Draw until you reach your hand limit"
                    >
                      Draw to limit
                    </button>
                  </div>

                  {!deckState ? (
                    <div className="text-sm text-gray-500 mt-2">No combat deck for this encounter.</div>
                  ) : handCount === 0 ? (
                    <div className="text-sm text-gray-500 mt-2">Empty</div>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <div className="flex gap-4 justify-center min-w-max px-2">
                        {sortedHand.map((cardId, idx) => {
                          const selected = selectedHandIndex === idx;
                          const name = cardsById[cardId] ?? cardId;
                          const img = cardImageById[cardId] ?? null;

                          return (
                            <div key={`${cardId}-${idx}`} className="w-[160px]">
                              <button
                                type="button"
                                onClick={() => setSelectedHandIndex(selected ? null : idx)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  openCardModal(cardId);
                                }}
                                className={`w-full border rounded-2xl p-2 hover:bg-gray-50 ${
                                  selected ? "bg-yellow-50 border-yellow-300" : ""
                                }`}
                                title="Left click: actions · Right click: view card"
                              >
                                {img ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={img}
                                    alt={name}
                                    className="w-full aspect-[785/1100] object-cover rounded-xl border bg-white"
                                  />
                                ) : (
                                  <div className="w-full aspect-[785/1100] rounded-xl border bg-gray-50 grid place-items-center text-xs text-gray-500">
                                    No image
                                  </div>
                                )}
                                <div className="mt-2 text-sm font-medium leading-tight line-clamp-2">{name}</div>
                              </button>

                              {/* Inline actions under the selected card */}
                              {selected && selectedCardId ? (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await moveCardToDiscard(selectedCardId);
                                      await logCardAction("play", selectedCardId);
                                    }}
                                    disabled={loading}
                                    className="px-3 py-2 rounded-xl border hover:bg-gray-50 disabled:opacity-50 text-sm"
                                  >
                                    Play
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await moveCardToDiscard(selectedCardId);
                                      await logCardAction("discard", selectedCardId);
                                    }}
                                    disabled={loading}
                                    className="px-3 py-2 rounded-xl border hover:bg-gray-50 disabled:opacity-50 text-sm"
                                  >
                                    Discard
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Deck (right) */}
                <button
                  onClick={() => setShowPile(showPile === "draw" ? null : "draw")}
                  className="w-[140px] border rounded-2xl p-3 hover:bg-gray-50 text-left shrink-0"
                >
                  <div className="text-xs text-gray-600">Deck</div>
                  <div className="font-semibold">{drawCount}</div>
                  <div className="text-[11px] text-gray-500">Tap to view</div>
                </button>
              </div>

              {/* Pile overlay (kept) */}
              {showPile ? (
                <div className="px-1 pb-1">
                  <div className="border rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-sm text-gray-700">
                        Viewing <span className="font-medium">{showPile}</span> pile (alphabetical)
                      </div>
                      <button type="button" className="underline text-sm" onClick={() => setShowPile(null)}>
                        close
                      </button>
                    </div>

                    {!deckState ? (
                      <div className="text-sm text-gray-500">No deck state.</div>
                    ) : (
                      (() => {
                        const pile = showPile === "draw" ? (deckState.draw_pile ?? []) : (deckState.discard_pile ?? []);
                        if (pile.length === 0) return <div className="text-sm text-gray-500">Empty.</div>;

                        const counts: Record<string, number> = {};
                        for (const id of pile) counts[id] = (counts[id] ?? 0) + 1;

                        const rows = Object.entries(counts)
                          .map(([id, qty]) => ({ id, qty, name: cardsById[id] ?? id }))
                          .sort((a, b) => a.name.localeCompare(b.name));

                        return (
                          <ul className="space-y-1">
                            {rows.map((r) => (
                              <li key={r.id} className="text-sm text-gray-700">
                                {r.name} {r.qty > 1 ? <span className="text-gray-500">×{r.qty}</span> : null}
                              </li>
                            ))}
                          </ul>
                        );
                      })()
                    )}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="border rounded-2xl p-3">
              <div className="text-xs text-gray-600">Exploration hand</div>

              {explorationSorted.length === 0 ? (
                <div className="text-sm text-gray-500 mt-2">No exploration deck found.</div>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <div className="flex gap-4 justify-center min-w-max px-2">
                    {explorationSorted.map((r) => {
                      const name = cardsById[r.card_id] ?? r.card_id;
                      const img = cardImageById[r.card_id] ?? null;
                      return (
                        <div key={r.card_id} className="w-[160px]">
                          <div key={r.card_id} className="w-[160px]">
                            <button
                              type="button"
                              onContextMenu={(e) => {
                                e.preventDefault();
                                openCardModal(r.card_id);
                              }}
                              className="w-full border rounded-2xl p-2 hover:bg-gray-50 text-left"
                              title="Right click: view card"
                            >
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={img}
                                  alt={name}
                                  className="w-full aspect-[785/1100] object-cover rounded-xl border bg-white"
                                />
                              ) : (
                                <div className="w-full aspect-[785/1100] rounded-xl border bg-gray-50 grid place-items-center text-xs text-gray-500">
                                  No image
                                </div>
                              )}

                              <div className="mt-2 flex items-start justify-between gap-2">
                                <div className="text-sm font-medium leading-tight line-clamp-2">{name}</div>
                                {r.qty > 1 ? <div className="text-xs border rounded-full px-2 py-1">{r.qty}×</div> : null}
                              </div>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 mt-2">Exploration mode has no draw/discard mechanics.</div>
            </div>
          )}
        </div>
      </div>
      {openCardId && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4"
          onClick={() => {
            setOpenCardId(null);
            setOpenCard(null);
            setOpenCardError(null);
          }}
        >
          <div
            className="bg-white text-black w-full max-w-3xl rounded-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xl font-semibold">
                  {openCard?.name ?? (openCardLoading ? "Loading…" : "Card")}
                </div>
                {openCardError ? (
                  <div className="text-sm text-red-600">{openCardError}</div>
                ) : null}
              </div>

              <button
                className="border rounded-md px-3 py-2"
                onClick={() => {
                  setOpenCardId(null);
                  setOpenCard(null);
                  setOpenCardError(null);
                }}
              >
                Close
              </button>
            </div>

            {openCardLoading ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : openCard ? (
              <>
                {openCard.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={openCard.imageUrl}
                    alt={openCard.name ?? "Card"}
                    className="w-full max-h-[420px] object-contain rounded-lg border bg-white"
                  />
                ) : (
                  <div className="w-full h-[220px] rounded-lg border bg-gray-50 grid place-items-center text-sm text-gray-500">
                    No image
                  </div>
                )}

                <div className="max-h-[45vh] overflow-y-auto pr-1">
                  <div className="text-sm whitespace-pre-wrap text-gray-800">
                    {openCard.rules_text ?? ""}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
