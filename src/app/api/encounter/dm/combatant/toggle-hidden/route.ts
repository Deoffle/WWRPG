import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const body = await req.json();
  const campaignId = body.campaignId as string;
  const combatantId = body.combatantId as string;
  const isHidden = Boolean(body.isHidden);

  if (!campaignId || !combatantId) {
    return NextResponse.json(
      { error: "campaignId and combatantId are required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("encounter_combatants")
    .update({ is_hidden: isHidden })
    .eq("campaign_id", campaignId)
    .eq("id", combatantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
