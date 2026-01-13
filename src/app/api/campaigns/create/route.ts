import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) return NextResponse.json({ error: "Missing campaign name" }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: "Name too long" }, { status: 400 });

  // 1) Create campaign
  const { data: campaign, error: cErr } = await supabase
    .from("campaigns")
    .insert({ name, owner_user_id: user.id })
    .select("id")
    .single();

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });

  // 2) Add creator as DM member
  const { error: mErr } = await supabase.from("campaign_members").insert({
    campaign_id: campaign.id,
    user_id: user.id,
    role: "dm",
  });

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });

  return NextResponse.json({ id: campaign.id });
}
