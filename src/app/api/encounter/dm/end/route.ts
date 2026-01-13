import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const body = await req.json();
  const campaignId = body.campaignId as string;

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  // Read current campaign_state to find active encounter
  const { data: state, error: stateErr } = await supabase
    .from("campaign_state")
    .select("active_encounter_id")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (stateErr) {
    return NextResponse.json({ error: stateErr.message }, { status: 400 });
  }

  const encounterId = state?.active_encounter_id ?? null;

  // Mark encounter ended (best effort)
  if (encounterId) {
    const { error: encErr } = await supabase
      .from("encounters")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", encounterId)
      .eq("campaign_id", campaignId);

    if (encErr) {
      return NextResponse.json({ error: encErr.message }, { status: 400 });
    }
  }

  // Switch back to exploration + clear active encounter
  const { error: stateUpdateErr } = await supabase
    .from("campaign_state")
    .upsert(
      {
        campaign_id: campaignId,
        mode: "exploration",
        active_encounter_id: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "campaign_id" }
    );

  if (stateUpdateErr) {
    return NextResponse.json({ error: stateUpdateErr.message }, { status: 400 });
  }

  return NextResponse.json({ campaignId, mode: "exploration" });
}
