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

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const body = await req.json();
  const campaignId = body.campaignId as string;
  const combatantId = body.combatantId as string;
  const labelRaw = body.label as string;

  const label = String(labelRaw ?? "").trim();

  if (!campaignId || !combatantId || !label) {
    return NextResponse.json(
      { error: "campaignId, combatantId, and label are required" },
      { status: 400 }
    );
  }

  const { data: row, error: readErr } = await supabase
    .from("encounter_combatants")
    .select("status_public")
    .eq("campaign_id", campaignId)
    .eq("id", combatantId)
    .single();

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 400 });

  const statuses = normalizeStatuses(row?.status_public);
  const next = statuses.filter((s) => s.label.toLowerCase() !== label.toLowerCase());

  const { error: writeErr } = await supabase
    .from("encounter_combatants")
    .update({ status_public: next })
    .eq("campaign_id", campaignId)
    .eq("id", combatantId);

  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
