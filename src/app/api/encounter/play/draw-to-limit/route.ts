import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const deckStateId = typeof body?.deckStateId === "string" ? body.deckStateId : "";
  if (!deckStateId) return NextResponse.json({ error: "Missing deckStateId" }, { status: 400 });

  // Get context so we can log to encounter_log
  const { data: ds, error: dsErr } = await supabase
    .from("combat_deck_state")
    .select("campaign_id, encounter_id, character_id")
    .eq("id", deckStateId)
    .single();

  if (dsErr) return NextResponse.json({ error: dsErr.message }, { status: 400 });

  // Call v2 RPC (returns drawn_ids)
  const { data, error } = await supabase.rpc("draw_to_hand_limit_v2", {
    p_deck_state_id: deckStateId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const row = Array.isArray(data) ? data[0] : data;
  const drawnIds: string[] = Array.isArray(row?.drawn_ids) ? row.drawn_ids : [];

  // Log draw with exact card ids for undo
  if (drawnIds.length) {
    const { data: ch } = await supabase
      .from("characters")
      .select("name")
      .eq("id", ds.character_id)
      .maybeSingle();

    await supabase.from("encounter_log").insert({
      campaign_id: ds.campaign_id,
      encounter_id: ds.encounter_id,
      visibility: "all",
      kind: "draw",
      actor_combatant_id: null,
      payload: {
        character_id: ds.character_id,
        character_name: ch?.name ?? null,
        card_ids: drawnIds,
      },
    });
  }

  return NextResponse.json({ ok: true, result: row });
}
