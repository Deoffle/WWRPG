import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function safeStructured(x: any) {
  if (x && typeof x === "object") return x;
  if (typeof x === "string") {
    try {
      const parsed = JSON.parse(x);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

type CardImageAsset = {
  kind: "card-image";
  bucket: "card-images";
  oldCardId: string;
  oldPath: string;
  contentType: string | null;
  base64: string;
};

async function downloadCardImages(supabase: any, cards: any[]): Promise<CardImageAsset[]> {
  const assets: CardImageAsset[] = [];

  for (const c of cards) {
    const oldCardId = String(c.id);

    const direct = typeof c.image_path === "string" ? c.image_path : null;
    const structured = safeStructured(c.structured);
    const legacy = typeof structured?.image_path === "string" ? structured.image_path : null;

    const oldPath = direct ?? legacy;
    if (!oldPath) continue;

    const { data, error } = await supabase.storage.from("card-images").download(oldPath);
    if (error || !data) continue;

    const ab = await data.arrayBuffer();
    const base64 = Buffer.from(ab).toString("base64");

    assets.push({
      kind: "card-image",
      bucket: "card-images",
      oldCardId,
      oldPath,
      contentType: (data as any)?.type ?? null,
      base64,
    });
  }

  return assets;
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId") ?? "";
  const includeAssets = url.searchParams.get("includeAssets") === "1";

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });

  // DM-only export
  const { data: mem, error: memErr } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", data.user.id)
    .single();

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });
  if (mem?.role !== "dm") return NextResponse.json({ error: "DM only" }, { status: 403 });

  const { data: campaign, error: campErr } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 400 });

  const [charactersRes, decksRes, cardsRes, monstersRes, bestiaryRes] = await Promise.all([
    supabase.from("characters").select("*").eq("campaign_id", campaignId),
    supabase.from("decks").select("*").eq("campaign_id", campaignId),
    supabase.from("cards").select("*").eq("campaign_id", campaignId),
    supabase.from("monsters").select("*").eq("campaign_id", campaignId),
    supabase.from("bestiary_entries").select("*").eq("campaign_id", campaignId),
  ]);

  if (charactersRes.error) return NextResponse.json({ error: charactersRes.error.message }, { status: 400 });
  if (decksRes.error) return NextResponse.json({ error: decksRes.error.message }, { status: 400 });
  if (cardsRes.error) return NextResponse.json({ error: cardsRes.error.message }, { status: 400 });
  if (monstersRes.error) return NextResponse.json({ error: monstersRes.error.message }, { status: 400 });
  if (bestiaryRes.error) return NextResponse.json({ error: bestiaryRes.error.message }, { status: 400 });

  const decks = decksRes.data ?? [];
  const deckIds = decks.map((d: any) => d.id).filter(Boolean);

  let deck_cards: any[] = [];
  if (deckIds.length) {
    const { data: dc, error: dcErr } = await supabase
      .from("deck_cards")
      .select("*")
      .in("deck_id", deckIds);

    if (dcErr) return NextResponse.json({ error: dcErr.message }, { status: 400 });
    deck_cards = dc ?? [];
  }

  const cards = cardsRes.data ?? [];
  const assets = includeAssets ? await downloadCardImages(supabase, cards) : [];

  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    campaign: {
      id: campaign.id,
      name: campaign.name,
      created_at: campaign.created_at,
      owner_user_id: campaign.owner_user_id,
    },
    tables: {
      characters: charactersRes.data ?? [],
      decks,
      deck_cards,
      cards,
      monsters: monstersRes.data ?? [],
      bestiary_entries: bestiaryRes.data ?? [],
    },
    assets,
  };

  return NextResponse.json(payload, {
    headers: { "Content-Type": "application/json" },
  });
}
