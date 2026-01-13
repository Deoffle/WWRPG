import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const body = await req.json();
  const campaignId = body.campaignId as string;
  const encounterId = body.encounterId as string;
  const combatantId = body.combatantId as string;
  const initiativeRaw = body.initiative;

  if (!campaignId || !encounterId || !combatantId || initiativeRaw === undefined || initiativeRaw === null) {
    return NextResponse.json(
      { error: "campaignId, encounterId, combatantId, initiative are required" },
      { status: 400 }
    );
  }

  const initiative = Number(initiativeRaw);
  if (!Number.isFinite(initiative)) {
    return NextResponse.json({ error: "initiative must be a number" }, { status: 400 });
  }

  // 1) Update initiative in the private table
  const { error: privErr } = await supabase
    .from("encounter_combatants_private")
    .update({ initiative })
    .eq("combatant_id", combatantId);

  if (privErr) {
    return NextResponse.json({ error: privErr.message }, { status: 400 });
  }

  // 2) Load all combatants in this encounter (we’ll compute order_index from initiative)
  const { data: combatants, error: combErr } = await supabase
    .from("encounter_combatants")
    .select("id, created_at, is_defeated")
    .eq("campaign_id", campaignId)
    .eq("encounter_id", encounterId);

  if (combErr) {
    return NextResponse.json({ error: combErr.message }, { status: 400 });
  }

  const ids = (combatants ?? []).map((c) => c.id);
  if (ids.length === 0) {
    return NextResponse.json({ error: "No combatants found" }, { status: 400 });
  }

  // 3) Load initiatives for those combatants (DM-only table; allowed for DM)
  const { data: privRows, error: privLoadErr } = await supabase
    .from("encounter_combatants_private")
    .select("combatant_id, initiative")
    .in("combatant_id", ids);

  if (privLoadErr) {
    return NextResponse.json({ error: privLoadErr.message }, { status: 400 });
  }

  const initById = new Map<string, number>();
  (privRows ?? []).forEach((r) => initById.set(r.combatant_id, r.initiative));

  // 4) Sort combatants: highest initiative first
  // Tie-breaker: created_at (older first)
  const sorted = (combatants ?? [])
    .slice()
    .sort((a, b) => {
      const ai = initById.get(a.id) ?? 0;
      const bi = initById.get(b.id) ?? 0;
      if (bi !== ai) return bi - ai; // DESC
      // tie: created_at ASC
      return String(a.created_at).localeCompare(String(b.created_at));
    });

  // 5) Write order_index = 0..n-1 based on that sorted list
  for (let i = 0; i < sorted.length; i++) {
    const { id } = sorted[i];

    const { error: updErr } = await supabase
      .from("encounter_combatants")
      .update({ order_index: i })
      .eq("campaign_id", campaignId)
      .eq("id", id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
