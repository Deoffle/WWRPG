import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CreateMonsterForm from "./create-monster-form";

export default async function MonstersPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/auth/login");

  const { data: monsters, error } = await supabase
    .from("monsters")
    .select("id,name,tags,created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Monsters (DM)</h1>
        <Link className="underline text-sm" href={`/app/c/${campaignId}`}>
          Back to campaign
        </Link>
        <p className="text-xs text-gray-600">
          If you’re not DM, RLS will block this page’s data.
        </p>
      </header>

      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Create monster</h2>
        <CreateMonsterForm campaignId={campaignId} />
      </section>

      <section className="space-y-2">
        {error && <p className="text-sm text-red-600">DB error: {error.message}</p>}
        {!error && (monsters?.length ?? 0) === 0 && (
          <p className="text-sm text-gray-600">No monsters yet.</p>
        )}

        <ul className="space-y-2">
          {(monsters ?? []).map((m) => (
            <li key={m.id} className="border rounded-lg p-3">
              <Link className="font-medium underline" href={`/app/c/${campaignId}/monsters/${m.id}`}>
                {m.name}
              </Link>
              <div className="text-sm text-gray-600">
                {(m.tags ?? []).length ? `Tags: ${(m.tags ?? []).join(", ")}` : "No tags"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Created: {new Date(m.created_at).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
