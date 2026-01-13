import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import EditCardForm from "./edit-card-form";
import CardPushEditor from "./card-push-editor";

type CharacterRow = { id: string; name: string };
type DeckRow = { id: string; deck_type: "combat" | "exploration"; character_id: string };
type DeckCardRow = { deck_id: string; quantity: number };

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string; cardId: string }>;
}) {
  const { campaignId, cardId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/login");

  const { data: card, error } = await supabase
    .from("cards")
    .select("id,campaign_id,name,tags,structured,created_at,updated_at")
    .eq("id", cardId)
    .eq("campaign_id", campaignId)
    .single();

  if (error || !card) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Card</h1>
        <p className="text-sm text-red-600">Could not load card: {error?.message ?? "Not found"}</p>
        <Link className="underline" href={`/app/c/${campaignId}/cards`}>
          Back to cards
        </Link>
      </main>
    );
  }

  const { data: charsRaw } = await supabase
    .from("characters")
    .select("id,name")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  const characters = (charsRaw ?? []) as CharacterRow[];

  const { data: decksRaw } = await supabase
    .from("decks")
    .select("id,deck_type,character_id")
    .eq("campaign_id", campaignId);

  const decks = (decksRaw ?? []) as DeckRow[];
  const deckIds = decks.map((d) => d.id);

  const { data: dcRaw } =
    deckIds.length > 0
      ? await supabase
          .from("deck_cards")
          .select("deck_id,quantity")
          .eq("card_id", cardId)
          .in("deck_id", deckIds)
      : { data: [] as any[] };

  const deckCards = (dcRaw ?? []) as DeckCardRow[];

  // Build initial per-character quantities
  const qtyByDeckId = new Map<string, number>();
  for (const r of deckCards) qtyByDeckId.set(r.deck_id, r.quantity);

  const initialByCharacter: Record<string, { combat: number; exploration: number }> = {};
  for (const ch of characters) initialByCharacter[ch.id] = { combat: 0, exploration: 0 };

  for (const d of decks) {
    const qty = qtyByDeckId.get(d.id) ?? 0;
    if (!initialByCharacter[d.character_id]) continue;
    if (d.deck_type === "combat") initialByCharacter[d.character_id].combat = qty;
    if (d.deck_type === "exploration") initialByCharacter[d.character_id].exploration = qty;
  }

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{card.name}</h1>
        <Link className="underline text-sm" href={`/app/c/${campaignId}/cards`}>
          Back to cards
        </Link>
      </header>

      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Edit (DM)</h2>
        <EditCardForm campaignId={campaignId} card={card} />
      </section>

      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Push to characters (DM)</h2>
        <CardPushEditor
          campaignId={campaignId}
          cardId={cardId}
          characters={characters}
          initialByCharacter={initialByCharacter}
          // If you want to limit UI based on encounter_type later, we can pass it too.
          structured={card.structured}
        />
      </section>
    </main>
  );
}
