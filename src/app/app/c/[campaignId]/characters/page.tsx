import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CreateCharacterForm from "./create-character-form";

export default async function CharactersPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/login");

  const { data: characters, error } = await supabase
    .from("characters")
    .select("id,name,created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Characters</h1>
        <Link className="underline text-sm" href={`/app/c/${campaignId}`}>
          Back to campaign
        </Link>
      </header>

      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Create character</h2>
        <CreateCharacterForm campaignId={campaignId} />
      </section>

      <section className="space-y-2">
        {error && <p className="text-sm text-red-600">DB error: {error.message}</p>}
        {!error && (characters?.length ?? 0) === 0 && (
          <p className="text-sm text-gray-600">No characters yet.</p>
        )}

        <ul className="space-y-2">
          {(characters ?? []).map((p) => (
            <li key={p.id} className="border rounded-lg p-3">
              <Link
                className="font-medium underline"
                href={`/app/c/${campaignId}/characters/${p.id}`}
              >
                {p.name}
              </Link>
              <div className="text-xs text-gray-500">id: {p.id}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
