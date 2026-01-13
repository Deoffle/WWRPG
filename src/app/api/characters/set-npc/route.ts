import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  const characterId = typeof body?.characterId === "string" ? body.characterId : "";
  const isNpc = Boolean(body?.isNpc);

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!characterId) return NextResponse.json({ error: "Missing characterId" }, { status: 400 });

  // read sheet so we preserve other keys
  const { data: character, error: readErr } = await supabase
    .from("characters")
    .select("sheet")
    .eq("id", characterId)
    .eq("campaign_id", campaignId)
    .single();

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 400 });

  const sheet = (character?.sheet ?? {}) as any;
  const nextSheet = { ...sheet, isNpc };

  const { error: writeErr } = await supabase
    .from("characters")
    .update({ sheet: nextSheet })
    .eq("id", characterId)
    .eq("campaign_id", campaignId);

  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
