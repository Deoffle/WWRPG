import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const isNpc = Boolean(body?.isNpc);

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  if (name.length > 120) return NextResponse.json({ error: "Name too long" }, { status: 400 });

  const sheet = { isNpc };

  // 1) Insert character and return id
  const { data: inserted, error: insErr } = await supabase
    .from("characters")
    .insert({
      campaign_id: campaignId,
      name,
      sheet,
    })
    .select("id")
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  const characterId = inserted.id as string;

  // 2) Ensure the 2 decks exist
  const { error: decksErr } = await supabase
    .from("decks")
    .upsert(
      [
        { campaign_id: campaignId, character_id: characterId, deck_type: "combat", name: "Combat deck" },
        { campaign_id: campaignId, character_id: characterId, deck_type: "exploration", name: "Exploration deck" },
      ],
      { onConflict: "campaign_id,character_id,deck_type" }
    );

  if (decksErr) return NextResponse.json({ error: decksErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, characterId });
}
