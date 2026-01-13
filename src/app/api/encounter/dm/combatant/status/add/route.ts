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
  const durationRaw = body.duration;

  const label = String(labelRaw ?? "").trim();
  const duration = Number(durationRaw);

  if (!campaignId || !combatantId || !label) {
    return NextResponse.json(
      { error: "campaignId, combatantId, and label are required" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json(
      { error: "duration must be a positive number" },
      { status: 400 }
    );
  }

  // Read existing status_public
  const { data: row, error: readErr } = await supabase
    .from("encounter_combatants")
    .select("status_public")
    .eq("campaign_id", campaignId)
    .eq("id", combatantId)
    .single();

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 400 });

  const statuses = normalizeStatuses(row?.status_public);

  // Upsert by label (overwrite duration if exists)
  const next = statuses.filter((s) => s.label.toLowerCase() !== label.toLowerCase());
  next.push({ label, remaining: Math.floor(duration) });

  const { error: writeErr } = await supabase
    .from("encounter_combatants")
    .update({ status_public: next })
    .eq("campaign_id", campaignId)
    .eq("id", combatantId);

  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
