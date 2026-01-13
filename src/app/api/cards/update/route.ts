import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function asString(x: any) {
  return typeof x === "string" ? x : "";
}

type Structured = {
  rarity?: "common" | "rare" | "epic" | "legendary";
  encounter_type?: "combat" | "exploration" | "both";
  description?: string;
  max_owned?: number;
  image_path?: string | null;
};

function isPlainObject(x: any): x is Record<string, any> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function toInt(x: any, fallback: number) {
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function sanitizeStructuredPatch(raw: any): Partial<Structured> | null {
  if (!isPlainObject(raw)) return null;

  const out: Partial<Structured> = {};

  if (raw.rarity === "legendary" || raw.rarity === "epic" || raw.rarity === "rare" || raw.rarity === "common") {
    out.rarity = raw.rarity;
  }

  if (raw.encounter_type === "combat" || raw.encounter_type === "exploration" || raw.encounter_type === "both") {
    out.encounter_type = raw.encounter_type;
  }

  if (typeof raw.description === "string") out.description = raw.description;

  if (raw.max_owned !== undefined && raw.max_owned !== null) {
    out.max_owned = Math.max(0, toInt(raw.max_owned, 1));
  }

  // allow explicit null to clear image
  if (raw.image_path === null) out.image_path = null;
  else if (typeof raw.image_path === "string") out.image_path = raw.image_path;

  return Object.keys(out).length ? out : null;
}

function coerceStructured(x: any): Record<string, any> {
  if (isPlainObject(x)) return x;

  // safety: handle legacy string JSON if it ever appears again
  if (typeof x === "string") {
    try {
      const once = JSON.parse(x);
      if (isPlainObject(once)) return once;
      if (typeof once === "string") {
        const twice = JSON.parse(once);
        if (isPlainObject(twice)) return twice;
      }
    } catch {}
  }

  return {};
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const campaignId = asString(body?.campaignId);
  const cardId = asString(body?.cardId);
  const name = asString(body?.name).trim();
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t: any) => typeof t === "string") : null;

  const structuredPatch = sanitizeStructuredPatch(body?.structuredPatch);

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!cardId) return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  let nextStructured: Record<string, any> | undefined = undefined;

  if (structuredPatch) {
    const { data: existing, error: readErr } = await supabase
      .from("cards")
      .select("structured")
      .eq("id", cardId)
      .eq("campaign_id", campaignId)
      .single();

    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 400 });

    const current = coerceStructured(existing?.structured);
    nextStructured = { ...current, ...structuredPatch };
  }

  const updatePayload: any = { name };
  if (tags !== null) updatePayload.tags = tags;
  if (nextStructured) updatePayload.structured = nextStructured;

  const { error } = await supabase
    .from("cards")
    .update(updatePayload)
    .eq("id", cardId)
    .eq("campaign_id", campaignId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
