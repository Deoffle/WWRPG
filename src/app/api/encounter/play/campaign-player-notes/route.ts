import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");

  if (!campaignId) {
    return NextResponse.json({ error: "missing_campaignId" }, { status: 400 });
  }

  // ✅ IMPORTANT: await (your helper returns a Promise)
  const supabase = await createSupabaseServerClient();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("campaign_player_notes")
    .select("body, updated_at")
    .eq("campaign_id", campaignId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    body: data?.body ?? "",
    updated_at: data?.updated_at ?? null,
  });
}

export async function POST(req: Request) {
  // ✅ IMPORTANT: await here too
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

  const { data, error } = await supabase
    .from("campaign_player_notes")
    .upsert(
      {
        campaign_id: campaignId,
        user_id: auth.user.id,
        body,
      },
      { onConflict: "campaign_id,user_id" }
    )
    .select("body, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    body: data?.body ?? "",
    updated_at: data?.updated_at ?? null,
  });
}
