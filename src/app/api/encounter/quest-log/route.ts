import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function asString(x: any) {
  return typeof x === "string" ? x : "";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campaignId = asString(searchParams.get("campaignId"));

  if (!campaignId) {
    return NextResponse.json({ error: "missing_campaignId" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // RLS enforces membership
  const { data, error } = await supabase
    .from("campaign_quest_log")
    .select("body, updated_at, updated_by")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    body: data?.body ?? "",
    updated_at: data?.updated_at ?? null,
    updated_by: data?.updated_by ?? null,
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const campaignId = asString(json?.campaignId);
  const body = typeof json?.body === "string" ? json.body : "";

  if (!campaignId) {
    return NextResponse.json({ error: "missing_campaignId" }, { status: 400 });
  }

  // Optional explicit role check (RLS also enforces, but this gives nicer error)
  const { data: memberRow, error: memberErr } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 400 });
  if (memberRow?.role !== "dm") return NextResponse.json({ error: "not_dm" }, { status: 403 });

  // Upsert (1 row per campaign)
  const { data, error } = await supabase
    .from("campaign_quest_log")
    .upsert(
      {
        campaign_id: campaignId,
        body,
        updated_by: auth.user.id,
      },
      { onConflict: "campaign_id" }
    )
    .select("body, updated_at, updated_by")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    body: data?.body ?? "",
    updated_at: data?.updated_at ?? null,
    updated_by: data?.updated_by ?? null,
  });
}
