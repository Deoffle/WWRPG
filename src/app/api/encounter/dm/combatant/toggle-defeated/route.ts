import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const body = await req.json();
  const campaignId = body.campaignId as string;
  const encounterId = body.encounterId as string;
  const combatantId = body.combatantId as string;
  const isDefeated = Boolean(body.isDefeated);

  if (!campaignId || !encounterId || !combatantId) {
    return NextResponse.json(
      { error: "campaignId, encounterId, and combatantId are required" },
      { status: 400 }
    );
  }

  // 1) Load encounter turn_index
  const { data: enc, error: encErr } = await supabase
    .from("encounters")
    .select("id, turn_index, round_number")
    .eq("campaign_id", campaignId)
    .eq("id", encounterId)
    .single();

  if (encErr) {
    return NextResponse.json({ error: encErr.message }, { status: 400 });
  }

  const currentTurnIndex = enc.turn_index ?? 0;

  // 2) Load combatants (we’ll compute how indices shift)
  const { data: allCombatants, error: combErr } = await supabase
    .from("encounter_combatants")
    .select("id, is_defeated, order_index, created_at")
    .eq("campaign_id", campaignId)
    .eq("encounter_id", encounterId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (combErr) {
    return NextResponse.json({ error: combErr.message }, { status: 400 });
  }

  const sorted = allCombatants ?? [];
  const activeBefore = sorted.filter((c) => !c.is_defeated);
  const idxBefore = activeBefore.findIndex((c) => c.id === combatantId);

  // 3) Compute the new turn_index so the same combatant stays current
  let newTurnIndex = currentTurnIndex;

  if (isDefeated) {
    // If we are defeating someone who is currently active:
    if (idxBefore !== -1) {
      const countAfter = activeBefore.length - 1;

      if (countAfter <= 0) {
        newTurnIndex = 0;
      } else if (idxBefore < currentTurnIndex) {
        // removing someone before current -> shift pointer back by 1
        newTurnIndex = Math.max(currentTurnIndex - 1, 0);
      } else if (idxBefore === currentTurnIndex) {
        // removing current -> keep same index, which now points to next
        newTurnIndex = Math.min(currentTurnIndex, countAfter - 1);
      } else {
        // removing after current -> pointer stays
        newTurnIndex = currentTurnIndex;
      }
    }
  } else {
    // Undo defeated: combatant becomes active again.
    // To preserve the same "current" combatant identity,
    // if the restored combatant lands before/at current index, shift pointer +1.
    const activeAfter = sorted
      .map((c) => (c.id === combatantId ? { ...c, is_defeated: false } : c))
      .filter((c) => !c.is_defeated);

    const idxAfter = activeAfter.findIndex((c) => c.id === combatantId);
    if (idxAfter !== -1 && idxAfter <= currentTurnIndex) {
      newTurnIndex = currentTurnIndex + 1;
      if (newTurnIndex >= activeAfter.length) {
        newTurnIndex = activeAfter.length - 1;
      }
    }
  }

  // 4) Update the combatant defeated flag
  const { error: updCombErr } = await supabase
    .from("encounter_combatants")
    .update({ is_defeated: isDefeated })
    .eq("campaign_id", campaignId)
    .eq("id", combatantId);

  if (updCombErr) {
    return NextResponse.json({ error: updCombErr.message }, { status: 400 });
  }

  // 5) Update encounter turn_index to the adjusted value
  const { error: updEncErr } = await supabase
    .from("encounters")
    .update({ turn_index: newTurnIndex })
    .eq("campaign_id", campaignId)
    .eq("id", encounterId);

  if (updEncErr) {
    return NextResponse.json({ error: updEncErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, turnIndex: newTurnIndex });
}
