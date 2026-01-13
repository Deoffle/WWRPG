import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeStructured(x: any): any {
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

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  const deckId = typeof body?.deckId === "string" ? body.deckId : "";
  const cardId = typeof body?.cardId === "string" ? body.cardId : "";
  const quantity = Number(body?.quantity);

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!deckId) return NextResponse.json({ error: "Missing deckId" }, { status: 400 });
  if (!cardId) return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }

  // Load deck (also ensures deck belongs to campaignId)
  const { data: deck, error: deckErr } = await supabase
    .from("decks")
    .select("id,campaign_id,deck_type")
    .eq("id", deckId)
    .single();

  if (deckErr || !deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  if (deck.campaign_id !== campaignId) return NextResponse.json({ error: "Deck/campaign mismatch" }, { status: 400 });

  const deckType = deck.deck_type as "combat" | "exploration";

  // Load card to enforce max_owned + encounter_type
  const { data: card, error: cardErr } = await supabase
    .from("cards")
    .select("id,campaign_id,structured")
    .eq("id", cardId)
    .eq("campaign_id", campaignId)
    .single();

  if (cardErr || !card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  const s = safeStructured(card.structured);

  const encounterType =
    s.encounter_type === "combat" || s.encounter_type === "exploration" || s.encounter_type === "both"
      ? s.encounter_type
      : "both";

  const maxOwned = Number.isFinite(Number(s.max_owned)) ? Math.max(0, Math.trunc(Number(s.max_owned))) : 1;

  // Enforce encounter compatibility
  if (deckType === "combat" && encounterType === "exploration") {
    return NextResponse.json({ error: "This card is exploration-only." }, { status: 400 });
  }
  if (deckType === "exploration" && encounterType === "combat") {
    return NextResponse.json({ error: "This card is combat-only." }, { status: 400 });
  }

  // Enforce max_owned
  if (quantity > maxOwned) {
    return NextResponse.json({ error: `Max owned for this card is ${maxOwned}.` }, { status: 400 });
  }

  // Apply change
  if (quantity === 0) {
    const { error } = await supabase.from("deck_cards").delete().eq("deck_id", deckId).eq("card_id", cardId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("deck_cards").upsert(
    { deck_id: deckId, card_id: cardId, quantity },
    { onConflict: "deck_id,card_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
