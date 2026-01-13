import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ItemsEditor from "./items-editor";
import NpcToggle from "./npc-toggle";
import CharacterSheetEditor from "./character-sheet-editor";

type DeckRow = {
  id: string;
  deck_type: "combat" | "exploration";
  name: string | null;
};

type Item = {
  id: string;
  name: string;
  qty: number;
  tags?: string[];
  notes?: string;
};

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ campaignId: string; characterId: string }>;
}) {
  const { campaignId, characterId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/login");

  const { data: character, error: characterErr } = await supabase
    .from("characters")
    .select("id,name,campaign_id,created_at,sheet")
    .eq("id", characterId)
    .eq("campaign_id", campaignId)
    .single();

  if (characterErr || !character) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Character</h1>
        <p className="text-sm text-red-600">
          Could not load character: {characterErr?.message ?? "Not found"}
        </p>
        <Link className="underline" href={`/app/c/${campaignId}/characters`}>
          Back to characters
        </Link>
      </main>
    );
  }

  const { data: decksRaw } = await supabase
    .from("decks")
    .select("id,deck_type,name")
    .eq("campaign_id", campaignId)
    .eq("character_id", characterId)
    .order("created_at", { ascending: true });

  const decks = (decksRaw ?? []) as unknown as DeckRow[];
  const combatDeck = decks.find((d) => d.deck_type === "combat") ?? null;
  const explorationDeck = decks.find((d) => d.deck_type === "exploration") ?? null;

  const sheet = (character.sheet ?? {}) as any;

  const initialCharacterSheet = sheet.characterSheet ?? null;
  const initialReportCard = sheet.reportCard ?? null; // legacy fallback, now stored inside characterSheet.reportCard too
  const initialItems = (sheet.items ?? []) as Item[];
  const initialIsNpc = Boolean(sheet?.isNpc);

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{character.name}</h1>
        <div className="flex gap-4 text-sm">
          <Link className="underline" href={`/app/c/${campaignId}/characters`}>
            Back to characters
          </Link>
          <Link className="underline" href={`/app/c/${campaignId}`}>
            Back to campaign
          </Link>
        </div>
      </header>

      <section className="border rounded-xl p-4 space-y-2">
        <h2 className="font-medium">Character settings</h2>
        <NpcToggle campaignId={campaignId} characterId={characterId} initialIsNpc={initialIsNpc} />
      </section>

      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Decks</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border rounded-lg p-3">
            <div className="font-medium">Combat deck</div>
            {combatDeck ? (
              <>
                <div className="text-sm text-gray-600">{combatDeck.name || "(Unnamed)"}</div>
                <Link className="underline text-sm" href={`/app/c/${campaignId}/decks/${combatDeck.id}`}>
                  Open deck
                </Link>
              </>
            ) : (
              <div className="text-sm text-gray-600">
                None yet. Create one on the{" "}
                <Link className="underline" href={`/app/c/${campaignId}/decks`}>
                  Decks
                </Link>{" "}
                page.
              </div>
            )}
          </div>

          <div className="border rounded-lg p-3">
            <div className="font-medium">Exploration deck</div>
            {explorationDeck ? (
              <>
                <div className="text-sm text-gray-600">{explorationDeck.name || "(Unnamed)"}</div>
                <Link className="underline text-sm" href={`/app/c/${campaignId}/decks/${explorationDeck.id}`}>
                  Open deck
                </Link>
              </>
            ) : (
              <div className="text-sm text-gray-600">
                None yet. Create one on the{" "}
                <Link className="underline" href={`/app/c/${campaignId}/decks`}>
                  Decks
                </Link>{" "}
                page.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Items</h2>
        <ItemsEditor campaignId={campaignId} characterId={characterId} initialItems={initialItems} />
      </section>

      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Character sheet</h2>
        <CharacterSheetEditor
        campaignId={campaignId}
        characterId={characterId}
        initialCharacterSheet={initialCharacterSheet}
        initialReportCard={initialReportCard} // you can remove this later if you want
        initialItems={initialItems}
      />
      </section>

      <section className="border rounded-xl p-4 space-y-2">
        <h2 className="font-medium">Sheet (raw JSON for now)</h2>
        <pre className="text-xs overflow-auto border rounded-lg p-3">
{JSON.stringify(character.sheet ?? {}, null, 2)}
        </pre>
      </section>
    </main>
  );
}
