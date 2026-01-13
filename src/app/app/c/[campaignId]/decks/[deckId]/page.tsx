import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import DeckEditor from "./deck-editor";

type DeckType = "combat" | "exploration";

type DeckRow = {
  id: string;
  campaign_id: string;
  deck_type: DeckType;
  name: string | null;
  character_id: string | null;
};

type CharacterRow = { id: string; name: string };

type Structured = {
  rarity?: "common" | "rare" | "epic" | "legendary";
  encounter_type?: "combat" | "exploration" | "both";
  description?: string;
  max_owned?: number;
  image_path?: string | null;
};

type CardUi = {
  id: string;
  name: string;
  tags: string[];
  rarity: "common" | "rare" | "epic" | "legendary";
  encounter_type: "combat" | "exploration" | "both";
  description: string;
  max_owned: number;
  image_path: string | null;
  image_url: string | null;
};

type DeckCardRow = { card_id: string; quantity: number };

function safeStructured(x: any): Structured {
  if (x && typeof x === "object") return x as Structured;
  if (typeof x === "string") {
    try {
      const parsed = JSON.parse(x);
      return parsed && typeof parsed === "object" ? (parsed as Structured) : {};
    } catch {
      return {};
    }
  }
  return {};
}

export default async function DeckPage({
  params,
}: {
  params: Promise<{ campaignId: string; deckId: string }>;
}) {
  const { campaignId, deckId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth/login");

  // 1) Load deck
  const { data: deck, error: deckErr } = await supabase
    .from("decks")
    .select("id,campaign_id,deck_type,name,character_id")
    .eq("id", deckId)
    .eq("campaign_id", campaignId)
    .single();

  const deckSafe = deck as unknown as DeckRow;

  if (deckErr || !deckSafe) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Deck</h1>
        <p className="text-sm text-red-600">Could not load deck: {deckErr?.message ?? "Not found"}</p>
        <Link className="underline" href={`/app/c/${campaignId}/decks`}>Back to decks</Link>
      </main>
    );
  }

  // 2) Character name
  let characterName = "Unknown";
  if (deckSafe.character_id) {
    const { data: p } = await supabase
      .from("characters")
      .select("id,name")
      .eq("campaign_id", campaignId)
      .eq("id", deckSafe.character_id)
      .maybeSingle();
    const pSafe = p as CharacterRow | null;
    if (pSafe?.name) characterName = pSafe.name;
  }

  // 3) Load all cards (structured-based)
  const { data: cardsRaw } = await supabase
    .from("cards")
    .select("id,name,tags,structured")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  const cards: CardUi[] = (cardsRaw ?? []).map((c: any) => {
    const s = safeStructured(c.structured);

    const rarity =
      s.rarity === "legendary" || s.rarity === "epic" || s.rarity === "rare" || s.rarity === "common"
        ? s.rarity
        : "common";

    const encounter_type =
      s.encounter_type === "combat" || s.encounter_type === "exploration" || s.encounter_type === "both"
        ? s.encounter_type
        : "both";

    const max_owned = Number.isFinite(Number(s.max_owned)) ? Math.max(0, Math.trunc(Number(s.max_owned))) : 1;
    const image_path = typeof s.image_path === "string" ? s.image_path : null;

    const image_url = image_path
      ? supabase.storage.from("card-images").getPublicUrl(image_path).data.publicUrl
      : null;

    return {
      id: c.id,
      name: c.name,
      tags: Array.isArray(c.tags) ? c.tags.filter((t: any) => typeof t === "string") : [],
      rarity,
      encounter_type,
      description: typeof s.description === "string" ? s.description : "",
      max_owned,
      image_path,
      image_url,
    };
  });

  const cardById = new Map(cards.map((c) => [c.id, c]));

  // 4) Load deck entries
  const { data: deckCardsRaw, error: entriesErr } = await supabase
    .from("deck_cards")
    .select("card_id,quantity")
    .eq("deck_id", deckId);

  if (entriesErr) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Deck</h1>
        <p className="text-sm text-red-600">Could not load deck cards: {entriesErr.message}</p>
        <Link className="underline" href={`/app/c/${campaignId}/decks`}>Back to decks</Link>
      </main>
    );
  }

  const entries = (deckCardsRaw ?? []) as unknown as DeckCardRow[];

  const initialEntries = entries
    .map((e) => {
      const card = cardById.get(e.card_id);
      if (!card) return null;
      return { card, quantity: e.quantity };
    })
    .filter(Boolean) as { card: CardUi; quantity: number }[];

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{deckSafe.name || "(Unnamed deck)"} — {deckSafe.deck_type}</h1>
        <p className="text-sm text-gray-600">Character: {characterName}</p>
        <Link className="underline text-sm" href={`/app/c/${campaignId}/decks`}>Back to decks</Link>
      </header>

      <DeckEditor
        campaignId={campaignId}
        deckId={deckId}
        deckType={deckSafe.deck_type}
        cards={cards}
        initialEntries={initialEntries}
      />
    </main>
  );
}
