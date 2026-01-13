import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function asString(x: any) {
  return typeof x === "string" ? x : "";
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = asString(body?.campaignId);
  const userId = asString(body?.userId);
  const characterIdRaw = body?.characterId;

  const characterId =
    typeof characterIdRaw === "string" && characterIdRaw.trim() ? characterIdRaw.trim() : null;

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  // DM-only guard (extra hardening; RLS should also enforce)
  const { data: meMember, error: meErr } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (meErr) return NextResponse.json({ error: meErr.message }, { status: 400 });
  if (meMember?.role !== "dm") return NextResponse.json({ error: "DM only" }, { status: 403 });

  // Ensure target member exists
  const { data: targetMember, error: targetErr } = await supabase
    .from("campaign_members")
    .select("campaign_id,user_id,character_id")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();

  if (targetErr) return NextResponse.json({ error: targetErr.message }, { status: 400 });
  if (!targetMember) {
    return NextResponse.json({ error: "Target user is not a member of this campaign." }, { status: 400 });
  }

  // If characterId provided, validate it belongs to this campaign
  if (characterId) {
    const { data: characterRow, error: characterErr } = await supabase
      .from("characters")
      .select("id,campaign_id")
      .eq("campaign_id", campaignId)
      .eq("id", characterId)
      .maybeSingle();

    if (characterErr) return NextResponse.json({ error: characterErr.message }, { status: 400 });
    if (!characterRow) {
      return NextResponse.json({ error: "That character does not exist in this campaign." }, { status: 400 });
    }

    // Prevent two members pointing at the same character:
    // clear any other member currently assigned to this character.
    const { error: clearOtherMemberErr } = await supabase
      .from("campaign_members")
      .update({ character_id: null })
      .eq("campaign_id", campaignId)
      .eq("character_id", characterId)
      .neq("user_id", userId);

    if (clearOtherMemberErr) {
      return NextResponse.json({ error: clearOtherMemberErr.message }, { status: 400 });
    }
  }

  // Update the canonical mapping on campaign_members
  const { error: setMemberErr } = await supabase
    .from("campaign_members")
    .update({ character_id: characterId })
    .eq("campaign_id", campaignId)
    .eq("user_id", userId);

  if (setMemberErr) return NextResponse.json({ error: setMemberErr.message }, { status: 400 });

  // OPTIONAL MIRROR (helps Play Screen if it still looks at characters.user_id)
  // Clear old character(s) for this user in this campaign
  const { error: clearCharactersErr } = await supabase
    .from("characters")
    .update({ user_id: null })
    .eq("campaign_id", campaignId)
    .eq("user_id", userId);

  if (clearCharactersErr) return NextResponse.json({ error: clearCharactersErr.message }, { status: 400 });

  // Set selected character's user_id
  if (characterId) {
    const { error: setCharacterErr } = await supabase
      .from("characters")
      .update({ user_id: userId })
      .eq("campaign_id", campaignId)
      .eq("id", characterId);

    if (setCharacterErr) return NextResponse.json({ error: setCharacterErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, assigned: characterId });
}
