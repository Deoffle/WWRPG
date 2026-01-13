import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const body = await req.json();
  const campaignId = body.campaignId as string;
  const encounterId = body.encounterId as string;
  const name = (body.name as string) ?? "Enemy";
  const isHidden = Boolean(body.isHidden);

  // Basic validation
  if (!campaignId || !encounterId) {
    return NextResponse.json(
      { error: "campaignId and encounterId are required" },
      { status: 400 }
    );
  }

  // Insert the public combatant row
  const { data: combatant, error: insertErr } = await supabase
    .from("encounter_combatants")
    .insert({
      campaign_id: campaignId,
      encounter_id: encounterId,
      kind: "enemy",
      name,
      is_hidden: isHidden,
      is_defeated: false,
      status_public: [],
    })
    .select("id")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }

  // Insert the private row (initiative/hp can be set later)
  const { error: privErr } = await supabase
    .from("encounter_combatants_private")
    .insert({
      combatant_id: combatant.id,
      initiative: 0,
      hp_current: 1,
      hp_max: 1,
      dm_notes: "",
    });

  if (privErr) {
    return NextResponse.json({ error: privErr.message }, { status: 400 });
  }

  return NextResponse.json({ combatantId: combatant.id });
}
