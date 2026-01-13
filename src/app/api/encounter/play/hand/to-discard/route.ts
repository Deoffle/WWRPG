import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const deckStateId = typeof body?.deckStateId === "string" ? body.deckStateId : "";
  const cardId = typeof body?.cardId === "string" ? body.cardId : "";

  if (!deckStateId) return NextResponse.json({ error: "Missing deckStateId" }, { status: 400 });
  if (!cardId) return NextResponse.json({ error: "Missing cardId" }, { status: 400 });

  const { data, error } = await supabase.rpc("move_card_from_hand_to_discard", {
    p_deck_state_id: deckStateId,
    p_card_id: cardId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, result: row });
}
