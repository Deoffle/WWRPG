import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import MonsterEditor from "./monster-editor";

export default async function MonsterPage({
  params,
}: {
  params: Promise<{ campaignId: string; monsterId: string }>;
}) {
  const { campaignId, monsterId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/auth/login");

  const { data: monster, error } = await supabase
    .from("monsters")
    .select("id,campaign_id,name,tags,data,gm_notes,created_at,updated_at")
    .eq("id", monsterId)
    .eq("campaign_id", campaignId)
    .single();

  if (error || !monster) {
    return (
      <main className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Monster</h1>
        <p className="text-sm text-red-600">Could not load: {error?.message ?? "Not found"}</p>
        <Link className="underline" href={`/app/c/${campaignId}/monsters`}>
          Back to monsters
        </Link>
      </main>
    );
  }

  const { data: characters } = await supabase
    .from("characters")
    .select("id,name,created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{monster.name}</h1>
        <div className="flex gap-4 text-sm">
          <Link className="underline" href={`/app/c/${campaignId}/monsters`}>
            Back to monsters
          </Link>
          <Link className="underline" href={`/app/c/${campaignId}`}>
            Back to campaign
          </Link>
        </div>
        <p className="text-xs text-gray-600">DM-only page.</p>
      </header>

      <MonsterEditor
        campaignId={campaignId}
        monster={monster as any}
        characters={(characters ?? []) as any}
      />
    </main>
  );
}
