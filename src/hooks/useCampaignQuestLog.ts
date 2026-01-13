"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type State = {
  value: string;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastSavedAt: string | null;
};

async function readError(res: Response): Promise<string> {
  // Try JSON first, then fall back to raw text, then status line.
  const statusLine = `HTTP ${res.status} ${res.statusText}`;

  try {
    const txt = await res.text();
    if (!txt) return statusLine;

    try {
      const json = JSON.parse(txt);
      return json?.error ?? json?.message ?? txt ?? statusLine;
    } catch {
      return txt;
    }
  } catch {
    return statusLine;
  }
}

export function useCampaignQuestLog(campaignId: string, opts?: { canEdit?: boolean }) {
  const canEdit = !!opts?.canEdit;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [state, setState] = useState<State>({
    value: "",
    isLoading: true,
    isSaving: false,
    error: null,
    lastSavedAt: null,
  });

  const load = useCallback(async () => {
    if (!campaignId) return;

    setState((s) => ({ ...s, isLoading: true, error: null }));

    const url = `/api/encounter/quest-log?campaignId=${encodeURIComponent(campaignId)}`;
    const res = await fetch(url);

    if (!res.ok) {
      const msg = await readError(res);
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      return;
    }

    const json = await res.json().catch(() => ({} as any));

    setState((s) => ({
      ...s,
      value: typeof json?.body === "string" ? json.body : "",
      lastSavedAt: json?.updated_at ?? null,
      isLoading: false,
      error: null,
    }));
  }, [campaignId]);

  const setValue = useCallback((v: string) => {
    setState((s) => ({ ...s, value: v }));
  }, []);

  const flushSave = useCallback(
    async (body: string) => {
      if (!campaignId || !canEdit) return;

      setState((s) => ({ ...s, isSaving: true, error: null }));

      const res = await fetch("/api/encounter/quest-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, body }),
      });

      if (!res.ok) {
        const msg = await readError(res);
        setState((s) => ({ ...s, isSaving: false, error: msg }));
        return;
      }

      const json = await res.json().catch(() => ({} as any));

      setState((s) => ({
        ...s,
        value: typeof json?.body === "string" ? json.body : s.value,
        lastSavedAt: json?.updated_at ?? s.lastSavedAt,
        isSaving: false,
        error: null,
      }));
    },
    [campaignId, canEdit]
  );

  // initial load
  useEffect(() => {
    load();
  }, [load]);

  // realtime updates (players + DM)
  useEffect(() => {
    if (!campaignId) return;

    const ch = supabase
      .channel(`questlog-${campaignId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_quest_log", filter: `campaign_id=eq.${campaignId}` },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [campaignId, supabase, load]);

  return { state, setValue, flushSave, reload: load };
}
