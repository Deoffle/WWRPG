import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  const encounterId = typeof body?.encounterId === "string" ? body.encounterId : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const visibility = body?.visibility === "dm" ? "dm" : "all";

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!encounterId) return NextResponse.json({ error: "Missing encounterId" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

  // DM-only by RLS (log: dm full). If not DM, this will fail.
  const { error } = await supabase.from("encounter_log").insert({
    campaign_id: campaignId,
    encounter_id: encounterId,
    visibility,
    kind: "note",
    actor_combatant_id: null,
    payload: { text },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
