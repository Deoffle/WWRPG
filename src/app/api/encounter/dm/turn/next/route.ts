import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Status = { label: string; remaining: number };

function normalizeStatuses(raw: any): Status[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (typeof x === "string") return { label: x, remaining: 1 };
      if (x && typeof x === "object") {
        const label = String(x.label ?? "").trim();
        const remaining = Number(x.remaining);
        if (!label) return null;
        return { label, remaining: Number.isFinite(remaining) ? remaining : 1 };
      }
      return null;
    })
    .filter(Boolean) as Status[];
}

function tickStatuses(raw: any): Status[] {
  const statuses = normalizeStatuses(raw);
  return statuses
    .map((s) => ({ ...s, remaining: Math.floor(Number(s.remaining)) - 1 }))
    .filter((s) => Number.isFinite(s.remaining) && s.remaining > 0);
}


export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const body = await req.json();
  const campaignId = body.campaignId as string;
  const encounterId = body.encounterId as string;

  if (!campaignId || !encounterId) {
    return NextResponse.json(
      { error: "campaignId and encounterId are required" },
      { status: 400 }
    );
  }

  // 1) Load encounter
  const { data: enc, error: encErr } = await supabase
    .from("encounters")
    .select("id, turn_index, round_number")
    .eq("id", encounterId)
    .eq("campaign_id", campaignId)
    .single();

  if (encErr) {
    return NextResponse.json({ error: encErr.message }, { status: 400 });
  }

  // 2) Load combatants in order (we count ONLY non-defeated by default)
  const { data: combatants, error: combErr } = await supabase
    .from("encounter_combatants")
    .select("id, order_index, is_defeated, status_public")
    .eq("campaign_id", campaignId)
    .eq("encounter_id", encounterId)
    .eq("is_defeated", false)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (combErr) {
    return NextResponse.json({ error: combErr.message }, { status: 400 });
  }

  const count = combatants?.length ?? 0;
  if (count === 0) {
    return NextResponse.json(
      { error: "No active combatants (all defeated or none added)." },
      { status: 400 }
    );
  }

  const currentTurnIndex = enc.turn_index ?? 0;
  const currentRound = enc.round_number ?? 1;

  // Tick down status counters for the combatant whose turn is ending
  const currentCombatant = (combatants ?? [])[currentTurnIndex];
  if (currentCombatant) {
    const nextStatuses = tickStatuses((currentCombatant as any).status_public);

    const { error: statusUpdErr } = await supabase
      .from("encounter_combatants")
      .update({ status_public: nextStatuses })
      .eq("campaign_id", campaignId)
      .eq("id", currentCombatant.id);

    if (statusUpdErr) {
      return NextResponse.json({ error: statusUpdErr.message }, { status: 400 });
    }
  }


  let nextTurnIndex = currentTurnIndex + 1;
  let nextRound = currentRound;

  if (nextTurnIndex >= count) {
    nextTurnIndex = 0;
    nextRound = currentRound + 1;
  }

  // 3) Update encounter
  const { error: updErr } = await supabase
    .from("encounters")
    .update({
      turn_index: nextTurnIndex,
      round_number: nextRound,
    })
    .eq("id", encounterId)
    .eq("campaign_id", campaignId);

  // If your encounters table does NOT have updated_at, Supabase will error.
  // If you get that error, tell me, and we’ll remove the updated_at line.

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  return NextResponse.json({
    encounterId,
    turnIndex: nextTurnIndex,
    roundNumber: nextRound,
    combatantCount: count,
  });
}
