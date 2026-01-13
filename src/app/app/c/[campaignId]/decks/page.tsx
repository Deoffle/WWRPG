import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CreateDeckForm from "./create-deck-form";

type CharacterRow = { id: string; name: string };

type DeckRow = {
  id: string;
  deck_type: "combat" | "exploration";
  name: string | null;
  created_at: string;
  character_id: string | null;
};

export default async function DecksPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth/login");

  const { data: characters, error: charactersErr } = await supabase
    .from("characters")
    .select("id,name")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  const { data: decksRaw, error: decksErr } = await supabase
    .from("decks")
    .select("id,deck_type,name,created_at,character_id")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  const decks = (decksRaw ?? []) as DeckRow[];
  const charactersSafe = (characters ?? []) as CharacterRow[];

  const characterNameById = new Map<string, string>();
  for (const p of charactersSafe) characterNameById.set(p.id, p.name);

  function characterName(characterId: string | null) {
    if (!characterId) return "Unknown";
    return characterNameById.get(characterId) ?? "Unknown";
  }

  const error = decksErr ?? charactersErr;

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Decks</h1>
        <Link className="underline text-sm" href={`/app/c/${campaignId}`}>
          Back to campaign
        </Link>
      </header>

      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Create deck (DM)</h2>
        <CreateDeckForm campaignId={campaignId} characters={charactersSafe} />
      </section>

      <section className="space-y-2">
        {error && <p className="text-sm text-red-600">DB error: {error.message}</p>}

        {!error && decks.length === 0 && (
          <p className="text-sm text-gray-600">No decks yet.</p>
        )}

        <ul className="space-y-2">
          {decks.map((d) => (
            <li key={d.id} className="border rounded-lg p-3">
              <Link className="font-medium underline" href={`/app/c/${campaignId}/decks/${d.id}`}>
                {d.name || "(Unnamed deck)"} — {d.deck_type}
              </Link>

              <div className="text-sm text-gray-600">Character: {characterName(d.character_id)}</div>

              <div className="text-xs text-gray-500 mt-1">id: {d.id}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
