import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");

  if (!campaignId) {
    return NextResponse.json({ error: "missing_campaignId" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // Optional: fast “is DM” check (RLS also enforces it, this just gives nicer errors)
  const { data: member, error: memErr } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });
  if (member?.role !== "dm") return NextResponse.json({ error: "not_dm" }, { status: 403 });

  const { data, error } = await supabase
    .from("campaign_dm_notes")
    .select("body, updated_at")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    body: data?.body ?? "",
    updated_at: data?.updated_at ?? null,
  });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const campaignId = json?.campaignId as string | undefined;
  const body = (json?.body ?? "") as string;

  if (!campaignId) {
    return NextResponse.json({ error: "missing_campaignId" }, { status: 400 });
  }

  const { data: member, error: memErr } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });
  if (member?.role !== "dm") return NextResponse.json({ error: "not_dm" }, { status: 403 });

  const { data, error } = await supabase
    .from("campaign_dm_notes")
    .upsert(
      { campaign_id: campaignId, body },
      { onConflict: "campaign_id" }
    )
    .select("body, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    body: data?.body ?? "",
    updated_at: data?.updated_at ?? null,
  });
}
