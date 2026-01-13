"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type NotesState = {
  value: string;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastSavedAt: string | null;
};

const ENDPOINT = "/api/encounter/play/campaign-player-notes";

export function useCampaignPlayerNotes(campaignId: string | null | undefined) {
  const [state, setState] = useState<NotesState>({
    value: "",
    isLoading: true,
    isSaving: false,
    error: null,
    lastSavedAt: null,
  });

  const lastSentRef = useRef<string>("");

  const canLoad = useMemo(() => !!campaignId && campaignId.length > 0, [campaignId]);

  const load = useCallback(async () => {
    if (!canLoad) {
      setState((s) => ({ ...s, isLoading: false, value: "", error: null }));
      lastSentRef.current = "";
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const url = `${ENDPOINT}?campaignId=${encodeURIComponent(campaignId!)}`;
      const res = await fetch(url, { method: "GET" });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `failed_to_load_notes_http_${res.status}`);
      }

      const body = typeof json?.body === "string" ? json.body : "";
      lastSentRef.current = body;

      setState((s) => ({
        ...s,
        value: body,
        isLoading: false,
        error: null,
        lastSavedAt: json?.updated_at ?? null,
      }));
    } catch (e: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: e?.message || "failed_to_load_notes",
      }));
    }
  }, [canLoad, campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  const setValue = useCallback((next: string) => {
    setState((s) => ({ ...s, value: next }));
  }, []);

  const flushSave = useCallback(
    async (nextValue: string) => {
      if (!canLoad) return;
      if (nextValue === lastSentRef.current) return;

      setState((s) => ({ ...s, isSaving: true, error: null }));

      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId, body: nextValue }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || `failed_to_save_notes_http_${res.status}`);
        }

        lastSentRef.current = nextValue;

        setState((s) => ({
          ...s,
          isSaving: false,
          error: null,
          lastSavedAt: json?.updated_at ?? new Date().toISOString(),
        }));
      } catch (e: any) {
        setState((s) => ({
          ...s,
          isSaving: false,
          error: e?.message || "failed_to_save_notes",
        }));
      }
    },
    [canLoad, campaignId]
  );

  return { state, setValue, load, flushSave };
}
