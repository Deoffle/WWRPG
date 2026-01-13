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

function sanitizeStructured(raw: any): Structured {
  if (!isPlainObject(raw)) return {};

  const rarity =
    raw.rarity === "legendary" || raw.rarity === "epic" || raw.rarity === "rare" || raw.rarity === "common"
      ? raw.rarity
      : undefined;

  const encounter_type =
    raw.encounter_type === "combat" || raw.encounter_type === "exploration" || raw.encounter_type === "both"
      ? raw.encounter_type
      : undefined;

  const description = typeof raw.description === "string" ? raw.description : undefined;

  const max_owned =
    raw.max_owned === undefined || raw.max_owned === null
      ? undefined
      : Math.max(0, toInt(raw.max_owned, 1));

  const image_path =
    raw.image_path === null ? null : typeof raw.image_path === "string" ? raw.image_path : undefined;

  const out: Structured = {};
  if (rarity) out.rarity = rarity;
  if (encounter_type) out.encounter_type = encounter_type;
  if (typeof description === "string") out.description = description;
  if (typeof max_owned === "number") out.max_owned = max_owned;
  if (image_path !== undefined) out.image_path = image_path;

  return out;
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const campaignId = asString(body?.campaignId);
  const name = asString(body?.name).trim();
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t: any) => typeof t === "string") : [];

  const structured = sanitizeStructured(body?.structured);

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const payload = {
    campaign_id: campaignId,
    name,
    tags,
    rules_text: "", // legacy; safe default
    type: "card",   // legacy
    tier: null,     // legacy
    cost: null,     // legacy
    structured,     // ✅ jsonb object
  };

  const { data: inserted, error } = await supabase
    .from("cards")
    .insert(payload)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ id: inserted.id });
}
