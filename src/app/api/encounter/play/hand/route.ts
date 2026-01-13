import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function imageUrlFromPath(path: string) {
  // This only works if the bucket "card-images" is PUBLIC.
  // (If it is private, tell me and we’ll switch to signed URLs.)
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/card-images/${path}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const deckStateId = searchParams.get("deckStateId");

  if (!deckStateId) {
    return NextResponse.json({ error: "missing_deckStateId" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData?.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("HAND_TABLE_NAME")
    .select(
      `
      id,
      deck_state_id,
      card_id,
      created_at,
      cards (
        id,
        name,
        structured
      )
    `
    )
    .eq("deck_state_id", deckStateId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const hand = (data ?? []).map((row: any) => {
    const imagePath = row?.cards?.structured?.image_path;
    const imageUrl = typeof imagePath === "string" && imagePath.length > 0 ? imageUrlFromPath(imagePath) : null;
    return {
      ...row,
      imageUrl,
    };
  });

  return NextResponse.json({ ok: true, hand });
}
