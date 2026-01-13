import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const body = await req.json().catch(() => ({}));
  const campaignId = String(body?.campaignId ?? "");
  const combatantId = String(body?.combatantId ?? "");
  const hpCurrentRaw = body?.hpCurrent;
  const hpMaxRaw = body?.hpMax;

  if (!campaignId || !combatantId || hpCurrentRaw === undefined || hpMaxRaw === undefined) {
    return NextResponse.json(
      { error: "campaignId, combatantId, hpCurrent, hpMax are required" },
      { status: 400 }
    );
  }

  // 🔒 Enforce: DM can NOT edit player characters
  const { data: comb, error: combErr } = await supabase
    .from("encounter_combatants")
    .select("id, kind")
    .eq("id", combatantId)
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (combErr) return NextResponse.json({ error: combErr.message }, { status: 400 });
  if (!comb) return NextResponse.json({ error: "Combatant not found" }, { status: 404 });

  if (comb.kind === "character") {
    return NextResponse.json({ error: "Not allowed (player controls HP)" }, { status: 403 });
  }

  const hpCurrent = Number(hpCurrentRaw);
  const hpMax = Number(hpMaxRaw);

  if (!Number.isFinite(hpCurrent) || !Number.isFinite(hpMax)) {
    return NextResponse.json({ error: "hpCurrent and hpMax must be numbers" }, { status: 400 });
  }

  const maxSafe = Math.max(0, Math.trunc(hpMax));
  const curSafe = Math.min(Math.max(0, Math.trunc(hpCurrent)), maxSafe);

  // Update DM/private
  const { error: privErr } = await supabase
    .from("encounter_combatants_private")
    .update({ hp_current: curSafe, hp_max: maxSafe })
    .eq("combatant_id", combatantId);

  if (privErr) return NextResponse.json({ error: privErr.message }, { status: 400 });

  // Update public so players can see it too
  const { error: pubErr } = await supabase
    .from("encounter_combatants")
    .update({ hp_current: curSafe, hp_max: maxSafe })
    .eq("id", combatantId)
    .eq("campaign_id", campaignId);

  if (pubErr) return NextResponse.json({ error: pubErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, hpCurrent: curSafe, hpMax: maxSafe });
}
