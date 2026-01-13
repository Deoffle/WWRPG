import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  const maxUses = Number.isInteger(body?.maxUses) ? body.maxUses : 1;
  const expiresInHours = Number.isInteger(body?.expiresInHours) ? body.expiresInHours : 168;

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });

  const { data: code, error } = await supabase.rpc("create_campaign_invite", {
    p_campaign_id: campaignId,
    p_expires_in_hours: expiresInHours,
    p_max_uses: maxUses,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ code });
}
