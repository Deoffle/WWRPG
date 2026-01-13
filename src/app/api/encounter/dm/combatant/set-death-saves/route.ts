import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function asString(x: any) {
  return typeof x === "string" ? x : "";
}
function asInt(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function clamp03(n: number) {
  return Math.max(0, Math.min(3, n));
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = asString(body?.campaignId);
  const combatantId = asString(body?.combatantId);

  const successes = clamp03(asInt(body?.successes, 0));
  const failures = clamp03(asInt(body?.failures, 0));

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!combatantId) return NextResponse.json({ error: "Missing combatantId" }, { status: 400 });

  // DM-only guard
  const { data: mem, error: memErr } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });
  if (mem?.role !== "dm") return NextResponse.json({ error: "DM only" }, { status: 403 });

  const { error } = await supabase
    .from("encounter_combatants")
    .update({
      death_saves_successes: successes,
      death_saves_failures: failures,
    })
    .eq("campaign_id", campaignId)
    .eq("id", combatantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, successes, failures });
}
