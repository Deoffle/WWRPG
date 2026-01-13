import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

async function initCombatDeckStatesForEncounter(
  supabase: any,
  campaignId: string,
  encounterId: string
) {
  // Player-owned characters only (so players always get their combat deck when combat starts)
  const { data: chars, error: charErr } = await supabase
    .from("characters")
    .select("id")
    .eq("campaign_id", campaignId)
    .not("user_id", "is", null);

  if (charErr) throw new Error(charErr.message);

  let created = 0;
  let skippedExisting = 0;
  let skippedNoDeck = 0;

  for (const ch of chars ?? []) {
    const characterId = ch.id as string;

    // Already exists?
    const { data: existing, error: existErr } = await supabase
      .from("combat_deck_state")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("encounter_id", encounterId)
      .eq("character_id", characterId)
      .maybeSingle();

    if (existErr) throw new Error(existErr.message);

    if (existing?.id) {
      skippedExisting++;
      continue;
    }

    // Find combat deck (you enforce 1 combat deck per character in DB)
    const { data: deck, error: deckErr } = await supabase
      .from("decks")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("character_id", characterId)
      .eq("deck_type", "combat")
      .maybeSingle();

    if (deckErr) throw new Error(deckErr.message);

    if (!deck?.id) {
      skippedNoDeck++;
      continue;
    }

    // Build draw pile from deck_cards quantities
    const { data: dcs, error: dcErr } = await supabase
      .from("deck_cards")
      .select("card_id, quantity")
      .eq("deck_id", deck.id);

    if (dcErr) throw new Error(dcErr.message);

    const pile: string[] = [];
    for (const row of dcs ?? []) {
      const cardId = (row as any).card_id as string;
      const qty = Number((row as any).quantity ?? 0);
      for (let k = 0; k < qty; k++) pile.push(cardId);
    }

    shuffle(pile);

    const { error: insErr } = await supabase.from("combat_deck_state").insert({
      campaign_id: campaignId,
      encounter_id: encounterId,
      character_id: characterId,
      deck_id: deck.id,
      hand_limit: 4,
      draw_pile: pile,
      hand: [],
      discard_pile: [],
    });

    if (insErr) throw new Error(insErr.message);

    created++;
  }

  return { created, skippedExisting, skippedNoDeck };
}


export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const body = await req.json();
  const campaignId = body.campaignId as string;

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  // 1) Create a new encounter
  const { data: encounter, error: encounterErr } = await supabase
    .from("encounters")
    .insert({
      campaign_id: campaignId,
      status: "active",
      round_number: 1,
      turn_index: 0,
      started_at: new Date().toISOString(),
      ended_at: null,
    })
    .select("id")
    .single();

  if (encounterErr) {
    return NextResponse.json({ error: encounterErr.message }, { status: 400 });
  }


  // 2) Upsert campaign_state to combat + set active encounter
  const { error: stateErr } = await supabase
    .from("campaign_state")
    .upsert(
      {
        campaign_id: campaignId,
        mode: "combat",
        active_encounter_id: encounter.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "campaign_id" }
    );

  let deckInit = { created: 0, skippedExisting: 0, skippedNoDeck: 0 };

  try {
    deckInit = await initCombatDeckStatesForEncounter(supabase, campaignId, encounter.id);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to init combat decks" }, { status: 400 });
  }


  if (stateErr) {
    return NextResponse.json({ error: stateErr.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    campaignId,
    encounterId: encounter.id,
    mode: "combat",
    deckInit,
  });

}
