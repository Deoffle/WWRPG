import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function asString(x: any) {
  return typeof x === "string" ? x : "";
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = asString(body?.campaignId);
  const characterId = asString(body?.characterId);
  const deckType = body?.deckType === "exploration" ? "exploration" : "combat";
  const nameRaw = asString(body?.name).trim();

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!characterId) return NextResponse.json({ error: "Missing characterId" }, { status: 400 });

  // If name is blank, don't overwrite an existing deck's name.
  // (On insert, decks.name has default '' anyway.)
  const payload: any = {
    campaign_id: campaignId,
    character_id: characterId,
    deck_type: deckType,
  };
  if (nameRaw) payload.name = nameRaw;

  const { data: row, error } = await supabase
    .from("decks")
    .upsert(payload, { onConflict: "campaign_id,character_id,deck_type" })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: row.id });
}
