"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import DmReferencePanel from "./reference-panel";

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
};


type LogRow = {
  id: string;
  created_at: string;
  kind: string | null;
  visibility: string | null;
  payload: any;
};


export default function DmClient({ campaignId }: { campaignId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [campaignState, setCampaignState] = useState<CampaignStateRow | null>(null);
  const [encounter, setEncounter] = useState<EncounterRow | null>(null);
  const [combatants, setCombatants] = useState<CombatantRow[]>([]);

  const [characters, setCharacters] = useState<{ id: string; name: string | null }[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");

  const [initiativeDraft, setInitiativeDraft] = useState<Record<string, string>>({});
  const [hpCurrentDraft, setHpCurrentDraft] = useState<Record<string, string>>({});
  const [hpMaxDraft, setHpMaxDraft] = useState<Record<string, string>>({});
  const [statusLabelDraft, setStatusLabelDraft] = useState<Record<string, string>>({});
  const [statusDurDraft, setStatusDurDraft] = useState<Record<string, string>>({});

  const [deathSucDraft, setDeathSucDraft] = useState<Record<string, string>>({});
  const [deathFailDraft, setDeathFailDraft] = useState<Record<string, string>>({});

  const [armEndCombat, setArmEndCombat] = useState(false);

  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<any>(null);
  const [openCardLoading, setOpenCardLoading] = useState(false);
  const [openCardError, setOpenCardError] = useState<string | null>(null);


  const activeEncounterId = campaignState?.active_encounter_id ?? null;

  const currentTurnIndex = encounter?.turn_index ?? 0;
  const activeCombatants = combatants.filter((c) => !c.is_defeated);
  const currentCombatant = activeCombatants[currentTurnIndex];
  const currentTurnCharacterId = currentCombatant?.character_id ?? null;

  const [notice, setNotice] = useState<string | null>(null);

  const [enemyName, setEnemyName] = useState("Enemy");
  const [enemyHidden, setEnemyHidden] = useState(false);

  const [logRows, setLogRows] = useState<LogRow[]>([]);
  const [logText, setLogText] = useState("");
  const [logVisibility, setLogVisibility] = useState<"all" | "dm">("all");

  useEffect(() => {
    setArmEndCombat(false);
  }, [activeEncounterId]);


    // Guard: if campaignId is missing, stop before we query Supabase
  if (!campaignId) {
    return (
      <div style={{ padding: 16 }}>
        <h1>DM Screen</h1>
        <div>
          <Link href={`/app`}>← Back to campaign</Link>
        </div>
        <div style={{ padding: 12, border: "1px solid #f99", background: "#fee" }}>
          <b>Error:</b> campaignId is missing from the URL params.
          <div style={{ marginTop: 8 }}>
            This usually means your folder is named <code>[campaignid]</code> but the code expects{" "}
            <code>[campaignId]</code>.
          </div>
        </div>
      </div>
    );
  }


  async function loadAll() {
    setLoading(true);
    setError(null);

    const currentSelectedCharacterId = selectedCharacterId;

    // 1) campaign_state
    const { data: state, error: stateErr } = await supabase
      .from("campaign_state")
      .select("campaign_id, mode, active_encounter_id")
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (stateErr) {
      setError(stateErr.message);
      setLoading(false);
      return;
    }

    setCampaignState(state ?? { campaign_id: campaignId, mode: "exploration", active_encounter_id: null });

    // Load campaign characters (for DM to add them)
    const { data: chars, error: charsErr } = await supabase
      .from("characters")
      .select("id, name")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });

    if (charsErr) {
      setError(charsErr.message);
      setLoading(false);
      return;
    }

    setCharacters(chars ?? []);

    // Default select first character if none selected yet
    if (!currentSelectedCharacterId && (chars?.length ?? 0) > 0) {
      setSelectedCharacterId(chars![0].id);
    }

    // 2) if encounter active, fetch encounter + combatants
    if (state?.active_encounter_id) {
      const encId = state.active_encounter_id;

      const { data: enc, error: encErr } = await supabase
        .from("encounters")
        .select("id, status, round_number, turn_index")
        .eq("id", encId)
        .single();

      if (encErr) {
        setError(encErr.message);
        setLoading(false);
        return;
      }
      setEncounter(enc);

      // Load encounter log (DM can see all rows by RLS)
    const { data: logs, error: logErr } = await supabase
      .from("encounter_log")
      .select("id, created_at, kind, visibility, payload")
      .eq("campaign_id", campaignId)
      .eq("encounter_id", encId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (logErr) {
      setError(logErr.message);
      setLoading(false);
      return;
    }

    setLogRows(logs ?? []);


      const { data: comb, error: combErr } = await supabase
        .from("encounter_combatants")
        .select("id, kind, name, character_id, order_index, is_hidden, is_defeated, status_public, death_saves_successes, death_saves_failures")
        .eq("campaign_id", campaignId)
        .eq("encounter_id", encId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (combErr) {
        setError(combErr.message);
        setLoading(false);
        return;
      }
      setCombatants(comb ?? []);

      const dsSuc: Record<string, string> = {};
      const dsFail: Record<string, string> = {};
      (comb ?? []).forEach((c) => {
        dsSuc[c.id] = String(c.death_saves_successes ?? 0);
        dsFail[c.id] = String(c.death_saves_failures ?? 0);
      });
      setDeathSucDraft(dsSuc);
      setDeathFailDraft(dsFail);

      // Load initiatives (DM-only)
      const combatantIds = (comb ?? []).map((c) => c.id);

      const { data: privRows, error: privErr } = await supabase
        .from("encounter_combatants_private")
        .select("combatant_id, initiative, hp_current, hp_max")
        .in("combatant_id", combatantIds);

      if (privErr) {
        setError(privErr.message);
        setLoading(false);
        return;
      }

      const initMap: Record<string, string> = {};
      (comb ?? []).forEach((c) => {
        const row = (privRows ?? []).find((r) => r.combatant_id === c.id);
        initMap[c.id] = String(row?.initiative ?? 0);
      });
      setInitiativeDraft(initMap);
      const curMap: Record<string, string> = {};
      const maxMap: Record<string, string> = {};

      (comb ?? []).forEach((c) => {
        const row = (privRows ?? []).find((r) => r.combatant_id === c.id);
        curMap[c.id] = String(row?.hp_current ?? 1);
        maxMap[c.id] = String(row?.hp_max ?? 1);
      });

      setHpCurrentDraft(curMap);
      setHpMaxDraft(maxMap);
    } else {
      setEncounter(null);
      setCombatants([]);
      setLogRows([]);
    }

    setLoading(false);
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
      .eq("campaign_id", campaignId)
      .maybeSingle();

    if (error || !data) {
      setOpenCardError(error?.message ?? "Card not found");
      setOpenCardLoading(false);
      return;
    }

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


  async function loadLogOnly(encounterId: string) {
    const { data: logs, error: logErr } = await supabase
      .from("encounter_log")
      .select("id, created_at, kind, visibility, payload")
      .eq("campaign_id", campaignId)
      .eq("encounter_id", encounterId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!logErr) {
      setLogRows(logs ?? []);
    }
    // If there is an error, ignore it silently (no blinking/no spam)
  }

  async function saveDeathSaves(combatantId: string) {
    setError(null);

    const res = await fetch("/api/encounter/dm/combatant/set-death-saves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        combatantId,
        successes: deathSucDraft[combatantId],
        failures: deathFailDraft[combatantId],
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error ?? "Failed to update death saves");
      return;
    }

    await loadAll();
  }


  async function startCombat() {
    setError(null);
    const res = await fetch("/api/encounter/dm/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Failed to start combat");
      return;
    }

    // reload from DB
    await loadAll();
  }

    async function endCombat() {
      setError(null);

      if (!armEndCombat) {
        setNotice("Arm “End combat” first.");
        setTimeout(() => setNotice(null), 2500);
        return;
      }

      const res = await fetch("/api/encounter/dm/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Failed to end combat");
        return;
      }

      setArmEndCombat(false);
      await loadAll();
    }




  async function addEnemy() {
    setError(null);
    if (!activeEncounterId) {
      setError("No active encounter. Start combat first.");
      return;
    }

    const res = await fetch("/api/encounter/dm/enemy/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        encounterId: activeEncounterId,
        name: enemyName,
        isHidden: enemyHidden,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Failed to add enemy");
      return;
    }

    // reload from DB
    await loadAll();
  }

  async function undoLastAction(characterId: string) {
    setError(null);
    if (!activeEncounterId) return;

    const res = await fetch("/api/encounter/dm/undo-last-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        encounterId: activeEncounterId,
        characterId,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error ?? "Undo failed");
      return;
    }

    setNotice("Undid last action.");
    setTimeout(() => setNotice(null), 2000);

    await loadAll();
  }


  async function addCharacter() {
    setError(null);
    if (!activeEncounterId) {
      setError("No active encounter. Start combat first.");
      return;
    }
    if (!selectedCharacterId) {
      setError("Select a character first.");
      return;
    }

    const res = await fetch("/api/encounter/dm/character/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        encounterId: activeEncounterId,
        characterId: selectedCharacterId,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Failed to add character");
      return;
    }

    if (json?.alreadyExists) {
      setNotice("Character already in encounter.");
    }

    // auto-clear notice after 3 seconds
    setTimeout(() => setNotice(null), 3000);

    await loadAll();
  }

  async function nextTurn() {
    setError(null);
    if (!activeEncounterId) {
      setError("No active encounter. Start combat first.");
      return;
    }

    const res = await fetch("/api/encounter/dm/turn/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, encounterId: activeEncounterId }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Failed to advance turn");
      return;
    }

    await loadAll();
  }

  async function setDefeated(combatantId: string, isDefeated: boolean) {
    setError(null);
    if (!activeEncounterId) {
      setError("No active encounter. Start combat first.");
      return;
    }

    const res = await fetch("/api/encounter/dm/combatant/toggle-defeated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        encounterId: activeEncounterId,
        combatantId,
        isDefeated,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Failed to update defeated");
      return;
    }

    await loadAll();
  }

  async function setHidden(combatantId: string, isHidden: boolean) {
    setError(null);

    const res = await fetch("/api/encounter/dm/combatant/toggle-hidden", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, combatantId, isHidden }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Failed to update hidden");
      return;
    }

    await loadAll();
  }

  async function addLogNote() {
    setError(null);

    if (!activeEncounterId) {
      setError("No active encounter.");
      return;
    }

    const text = logText.trim();
    if (!text) return; // no spam

    const res = await fetch("/api/encounter/dm/log/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        encounterId: activeEncounterId,
        visibility: logVisibility,
        text,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error ?? "Failed to add log note");
      return;
    }

    setLogText("");
    // realtime should refresh, but this makes it immediate:
    await loadAll();
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


  async function saveInitiative(combatantId: string) {
    setError(null);
    if (!activeEncounterId) {
      setError("No active encounter. Start combat first.");
      return;
    }

    const value = initiativeDraft[combatantId];

    const res = await fetch("/api/encounter/dm/combatant/set-initiative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        encounterId: activeEncounterId,
        combatantId,
        initiative: value,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Failed to update initiative");
      return;
    }

    await loadAll();
  }

  async function saveHp(combatantId: string) {
    setError(null);

    const res = await fetch("/api/encounter/dm/combatant/set-hp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        combatantId,
        hpCurrent: hpCurrentDraft[combatantId],
        hpMax: hpMaxDraft[combatantId],
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Failed to update HP");
      return;
    }

    await loadAll();
  }

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

  async function addStatus(combatantId: string) {
    setError(null);

    const label = (statusLabelDraft[combatantId] ?? "").trim();
    const duration = Number(statusDurDraft[combatantId] ?? "1");

    if (!label) {
      setError("Status label cannot be empty.");
      return;
    }

    const res = await fetch("/api/encounter/dm/combatant/status/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, combatantId, label, duration }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Failed to add status");
      return;
    }

    // Clear input for that combatant
    setStatusLabelDraft((prev) => ({ ...prev, [combatantId]: "" }));
    setStatusDurDraft((prev) => ({ ...prev, [combatantId]: "1" }));

    await loadAll();
  }

  async function removeStatus(combatantId: string, label: string) {
    setError(null);

    const res = await fetch("/api/encounter/dm/combatant/status/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, combatantId, label }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Failed to remove status");
      return;
    }

    await loadAll();
  }


  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // Optional realtime: if Realtime isn't enabled, this just won't update — still fine.
  useEffect(() => {
    if (!campaignId) return;

    const channel = supabase
      .channel(`dm-${campaignId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_state", filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          console.log("[dm realtime campaign_state]", payload);
          loadAll();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "encounters", filter: `campaign_id=eq.${campaignId}` },
        () => loadAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "encounter_combatants", filter: `campaign_id=eq.${campaignId}` },
        () => loadAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "encounter_combatants_private" },
        () => loadAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "encounter_log" },
        (payload) => {
          console.log("[dm realtime encounter_log]", payload);
          loadAll();
        }
      )
      .subscribe((status) => {
        console.log("[dm realtime status]", status);
      });

      // Safety poll (keeps DM log fresh even if encounter_log doesn't emit events)
      const t = setInterval(() => {
        const encId = activeEncounterId;
        if (encId) loadLogOnly(encId);
      }, 2000);

      return () => {
        clearInterval(t);
        supabase.removeChannel(channel);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, activeEncounterId]);



  return (
    <main className="p-6 pb-24">
      <div className="max-w-6xl lg:flex gap-4">
        {/* LEFT: your existing DM screen */}
        <section className="flex-1 space-y-6 min-w-0">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold">DM Screen</h1>

            {/* Back to campaign landing page */}
            <Link className="underline text-sm" href={`/app/c/${campaignId}`}>
              ← Back to campaign
            </Link>

            {error ? <p className="text-sm text-red-600">Error: {error}</p> : null}
            {notice ? <p className="text-sm text-red-600">{notice}</p> : null}

            <div className="text-sm text-gray-600">
              <div>
                <span className="font-medium text-gray-800">Campaign:</span> {campaignId}
              </div>
              <div>
                <span className="font-medium text-gray-800">Mode:</span>{" "}
                {campaignState?.mode ?? "unknown"}
              </div>
            </div>

            <div className="flex gap-2 flex-wrap pt-2">
              <button
                onClick={loadAll}
                disabled={loading}
                className="px-3 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
              >
                Reload
              </button>

              {!activeEncounterId ? (
                <button
                  onClick={startCombat}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg border bg-black text-white hover:opacity-90 disabled:opacity-50"
                >
                  Start Combat
                </button>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={armEndCombat}
                      onChange={(e) => setArmEndCombat(e.target.checked)}
                    />
                    <span className="font-medium">Arm “End combat”</span>
                  </label>

                  <button
                    onClick={endCombat}
                    disabled={loading || !armEndCombat}
                    className="px-3 py-2 rounded-lg border bg-black text-white hover:opacity-90 disabled:opacity-50"
                    title={!armEndCombat ? "Enable the toggle to avoid accidental clicks" : "End combat"}
                  >
                    End Combat (Back to Exploration)
                  </button>
                </div>
              )}
            </div>
          </header>

          {!activeEncounterId ? (
            <section className="border rounded-xl p-4 space-y-2">
              <p className="text-sm text-gray-600">No active encounter.</p>
            </section>
          ) : (
            <section className="border rounded-xl p-4 space-y-4">
              {/* ✅ EVERYTHING below here is your existing content unchanged */}
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="font-medium">Active encounter:</span> {activeEncounterId}
                </div>
                <div className="flex gap-4 flex-wrap text-sm text-gray-600">
                  <div>
                    <span className="font-medium text-gray-800">Round:</span>{" "}
                    {encounter?.round_number ?? "?"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-800">Turn index:</span>{" "}
                    {encounter?.turn_index ?? "?"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-800">Status:</span>{" "}
                    {encounter?.status ?? "?"}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap pt-2">
                  <button
                    onClick={nextTurn}
                    disabled={loading}
                    className="px-3 py-2 rounded-lg border bg-black text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Next Turn
                  </button>

                  <button
                    onClick={() => {
                      if (!currentTurnCharacterId) {
                        setNotice("No current player character to undo.");
                        setTimeout(() => setNotice(null), 2000);
                        return;
                      }
                      undoLastAction(currentTurnCharacterId);
                    }}
                    disabled={loading || !currentTurnCharacterId}
                    className="px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    title={
                      !currentTurnCharacterId
                        ? "Current combatant is not a player character"
                        : "Undo last draw/play/discard for the current player"
                    }
                  >
                    Undo last action
                  </button>
                </div>
              </div>
          <div className="border rounded-xl p-4 space-y-3">
            <h2 className="font-medium">Add enemy</h2>

            <div className="flex gap-2 items-center flex-wrap">
              <input
                value={enemyName}
                onChange={(e) => setEnemyName(e.target.value)}
                placeholder="Enemy name"
                className="px-3 py-2 border rounded-lg w-64"
              />

              <label className="flex gap-2 items-center text-sm">
                <input
                  type="checkbox"
                  checked={enemyHidden}
                  onChange={(e) => setEnemyHidden(e.target.checked)}
                />
                Start hidden
              </label>

              <button
                onClick={addEnemy}
                disabled={loading}
                className="px-3 py-2 rounded-lg border bg-black text-white hover:opacity-90 disabled:opacity-50"
              >
                Add Enemy
              </button>
            </div>
          <div className="border rounded-xl p-4 space-y-3">
            <h2 className="font-medium">Add character</h2>

            {characters.length === 0 ? (
              <p className="text-sm text-gray-600">No characters found in this campaign.</p>
            ) : (
              <div className="flex gap-2 items-center flex-wrap">
                <select
                  value={selectedCharacterId}
                  onChange={(e) => setSelectedCharacterId(e.target.value)}
                  className="px-3 py-2 border rounded-lg"
                >
                  {characters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name ?? ch.id}
                    </option>
                  ))}
                </select>

                <button
                  onClick={addCharacter}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg border bg-black text-white hover:opacity-90 disabled:opacity-50"
                >
                  Add Character
                </button>
              </div>
            )}
          </div>

          </div>

          <div className="space-y-2">
            <h2 className="font-medium">Combatants ({combatants.length})</h2>

            {combatants.length === 0 ? (
              <p className="text-sm text-gray-600">No combatants yet.</p>
            ) : (
            <ul className="space-y-2">
              {combatants.map((c) => {
                const activeIndex = activeCombatants.findIndex((x) => x.id === c.id);
                const isCurrent = activeIndex === currentTurnIndex && activeIndex !== -1;

                return (
                  <li
                    key={c.id}
                    className={`border rounded-lg p-3 ${
                      isCurrent ? "border-yellow-300" : ""
                    } ${c.is_defeated ? "opacity-60" : ""}`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* LEFT */}
                      <div className="space-y-2">
                        <div>
                          <div className="font-medium">
                            {isCurrent ? "⭐ " : ""}
                            {c.name ?? "(no name)"}
                          </div>
                          <div className="text-xs text-gray-500">
                            kind: {c.kind} · hidden: {String(c.is_hidden)} · defeated:{" "}
                            {String(c.is_defeated)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="text-xs text-gray-600">Initiative</label>
                          <input
                            value={initiativeDraft[c.id] ?? "0"}
                            onChange={(e) =>
                              setInitiativeDraft((prev) => ({ ...prev, [c.id]: e.target.value }))
                            }
                            className="px-2 py-1 border rounded-md w-20"
                            inputMode="numeric"
                          />
                          <button
                            onClick={() => saveInitiative(c.id)}
                            disabled={loading}
                            className="px-3 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>

                      {/* RIGHT */}
                      <div className="space-y-3">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setDefeated(c.id, !c.is_defeated)}
                            disabled={loading}
                            className="px-3 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                          >
                            {c.is_defeated ? "Undo Defeated" : "Mark Defeated"}
                          </button>

                          {c.kind === "enemy" || c.kind === "npc" ? (
                            <button
                              onClick={() => setHidden(c.id, !c.is_hidden)}
                              disabled={loading}
                              className="px-3 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                            >
                              {c.is_hidden ? "Reveal" : "Hide"}
                            </button>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs text-gray-600">Statuses</div>

                          <div className="flex gap-2 flex-wrap">
                            {readStatuses(c.status_public).length === 0 ? (
                              <span className="text-sm text-gray-500">None</span>
                            ) : (
                              readStatuses(c.status_public).map((s) => (
                                <span
                                  key={s.label}
                                  className="inline-flex items-center gap-2 border rounded-full px-3 py-1 text-sm"
                                >
                                  <span>
                                    {s.label} ({s.remaining})
                                  </span>
                                  <button
                                    onClick={() => removeStatus(c.id, s.label)}
                                    disabled={loading}
                                    className="text-sm underline disabled:opacity-50"
                                    title="Remove"
                                  >
                                    x
                                  </button>
                                </span>
                              ))
                            )}
                          </div>

                          <div className="flex gap-2 items-center flex-wrap">
                            <input
                              value={statusLabelDraft[c.id] ?? ""}
                              onChange={(e) =>
                                setStatusLabelDraft((prev) => ({ ...prev, [c.id]: e.target.value }))
                              }
                              placeholder="e.g. stunned"
                              className="px-3 py-2 border rounded-lg w-56"
                            />
                            <input
                              value={statusDurDraft[c.id] ?? "1"}
                              onChange={(e) =>
                                setStatusDurDraft((prev) => ({ ...prev, [c.id]: e.target.value }))
                              }
                              placeholder="turns"
                              className="px-3 py-2 border rounded-lg w-24"
                              inputMode="numeric"
                            />
                            <button
                              onClick={() => addStatus(c.id)}
                              disabled={loading}
                              className="px-3 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {c.kind === "enemy" || c.kind === "npc" ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <label className="text-xs text-gray-600">HP</label>

                            <input
                              value={hpCurrentDraft[c.id] ?? "1"}
                              onChange={(e) =>
                                setHpCurrentDraft((prev) => ({ ...prev, [c.id]: e.target.value }))
                              }
                              className="px-2 py-1 border rounded-md w-20"
                              inputMode="numeric"
                              placeholder="cur"
                            />

                            <span className="text-sm text-gray-500">/</span>

                            <input
                              value={hpMaxDraft[c.id] ?? "1"}
                              onChange={(e) =>
                                setHpMaxDraft((prev) => ({ ...prev, [c.id]: e.target.value }))
                              }
                              className="px-2 py-1 border rounded-md w-20"
                              inputMode="numeric"
                              placeholder="max"
                            />

                            <button
                              onClick={() => saveHp(c.id)}
                              disabled={loading}
                              className="px-3 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                            >
                              Save HP
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">
                            Player HP is controlled by the player.
                          </div>
                        )}



                        {c.kind === "character" ? (
                          <div className="space-y-2">
                            <div className="text-xs text-gray-600">Death saves</div>

                            <div className="flex items-center gap-3 flex-wrap">
                              <label className="text-xs text-gray-600">Success</label>
                              <select
                                className="px-2 py-1 border rounded-md"
                                value={deathSucDraft[c.id] ?? "0"}
                                onChange={(e) => setDeathSucDraft((p) => ({ ...p, [c.id]: e.target.value }))}
                              >
                                <option value="0">0</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                              </select>

                              <label className="text-xs text-gray-600">Fail</label>
                              <select
                                className="px-2 py-1 border rounded-md"
                                value={deathFailDraft[c.id] ?? "0"}
                                onChange={(e) => setDeathFailDraft((p) => ({ ...p, [c.id]: e.target.value }))}
                              >
                                <option value="0">0</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                              </select>

                              <button
                                onClick={() => saveDeathSaves(c.id)}
                                disabled={loading}
                                className="px-3 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                              >
                                Save
                              </button>

                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            )}
          </div>
          <section className="border rounded-xl p-4 space-y-3">
            <h2 className="font-medium">Encounter log</h2>

            <div className="flex gap-2 flex-wrap items-center">
              <select
                value={logVisibility}
                onChange={(e) => setLogVisibility(e.target.value === "dm" ? "dm" : "all")}
                className="px-3 py-2 rounded-lg border"
              >
                <option value="all">Public</option>
                <option value="dm">DM only</option>
              </select>

              <input
                value={logText}
                onChange={(e) => setLogText(e.target.value)}
                placeholder="Write a note..."
                className="px-3 py-2 rounded-lg border flex-1 min-w-[240px]"
              />

              <button
                type="button"
                onClick={addLogNote}
                disabled={loading}
                className="px-3 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
              >
                Add note
              </button>
            </div>

            {logRows.length === 0 ? (
            <div className="text-sm text-gray-500">No log entries yet.</div>
            ) : (
              <ul className="space-y-2">
                {logRows.map((r) => {
                  const p = (r.payload ?? {}) as any;

                  let line = "";
                  if (r.kind === "note") {
                    line = String(p.text ?? "");
                  } else if (r.kind === "card") {
                    const action = p.action;
                    const cardName = p.card_name ?? "(card)";
                    const who = p.character_name ?? "Someone";
                    line = `${who} ${action === "play" ? "played" : "discarded"} ${cardName}`;
                  } else {
                    line = `${r.kind ?? "log"} entry`;
                  }

                  const isCard = r.kind === "card";
                  const action = p?.action;
                  const who = p?.character_name ?? "Someone";
                  const cardName = p?.card_name ?? "(card)";
                  const cardId = typeof p?.card_id === "string" ? p.card_id : "";

                  return (
                    <li key={r.id} className="text-sm">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          {isCard ? (
                            <>
                              <span>{who} </span>
                              <span>{action === "play" ? "played" : "discarded"} </span>
                              <button
                                type="button"
                                className="underline"
                                onClick={() => {
                                  if (cardId) openCardModal(cardId);
                                }}
                              >
                                {cardName}
                              </button>
                            </>
                          ) : (
                            <>{line}</>
                          )}
                        </div>

                        <div className="text-xs text-gray-500">
                          {r.visibility === "dm" ? "DM" : "Public"} ·{" "}
                          {new Date(r.created_at).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
            </section>
          )}

          {/* modal stays in LEFT column so it still works */}
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
                    {openCardError ? <div className="text-sm text-red-600">{openCardError}</div> : null}
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
        </section>

        {/* RIGHT: DM reference sidebar */}
        <DmReferencePanel campaignId={campaignId} />
      </div>
    </main>
  );
}