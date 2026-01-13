import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  const encounterId = typeof body?.encounterId === "string" ? body.encounterId : "";
  const characterId = typeof body?.characterId === "string" ? body.characterId : "";
  const action = typeof body?.action === "string" ? body.action : "";
  const cardId = typeof body?.cardId === "string" ? body.cardId : "";
  const cardName = typeof body?.cardName === "string" ? body.cardName : "";

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!encounterId) return NextResponse.json({ error: "Missing encounterId" }, { status: 400 });
  if (!characterId) return NextResponse.json({ error: "Missing characterId" }, { status: 400 });
  if (!cardId) return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
  if (action !== "play" && action !== "discard") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Verify ownership (character.user_id must match auth user)
  const { data: ch, error: chErr } = await supabase
    .from("characters")
    .select("id,user_id,name")
    .eq("id", characterId)
    .eq("campaign_id", campaignId)
    .single();

  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 400 });
  if (ch.user_id !== userData.user.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const payload = {
    action,
    card_id: cardId,
    card_name: cardName || null,
    character_id: characterId,
    character_name: ch.name ?? null,
  };

  const { error: insErr } = await supabase.from("encounter_log").insert({
    campaign_id: campaignId,
    encounter_id: encounterId,
    visibility: "all",
    kind: "card",
    actor_combatant_id: null,
    payload,
  });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
