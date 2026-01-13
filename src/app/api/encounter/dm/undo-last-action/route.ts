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

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!encounterId) return NextResponse.json({ error: "Missing encounterId" }, { status: 400 });
  if (!characterId) return NextResponse.json({ error: "Missing characterId" }, { status: 400 });

  const { data: ds, error: dsErr } = await supabase
    .from("combat_deck_state")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("encounter_id", encounterId)
    .eq("character_id", characterId)
    .maybeSingle();

  const { data: mem, error: memErr } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", userData.user.id)
    .single();

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });
  if (mem?.role !== "dm") return NextResponse.json({ error: "DM only" }, { status: 403 });


  if (dsErr) return NextResponse.json({ error: dsErr.message }, { status: 400 });
  if (!ds?.id) return NextResponse.json({ error: "No deck state for that character" }, { status: 400 });

  const { data, error } = await supabase.rpc("undo_last_deck_action", {
    p_deck_state_id: ds.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, result: row });
}
