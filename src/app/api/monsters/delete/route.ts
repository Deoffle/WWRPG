import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const monsterId = typeof body?.monsterId === "string" ? body.monsterId : "";
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!monsterId) return NextResponse.json({ error: "Missing monsterId" }, { status: 400 });

  const { error } = await supabase
    .from("monsters")
    .delete()
    .eq("id", monsterId)
    .eq("campaign_id", campaignId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
