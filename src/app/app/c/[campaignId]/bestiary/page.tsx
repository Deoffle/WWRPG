import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BestiaryClient from "./bestiary-client";

type EntryRow = {
  id: string;
  category: string;
  reveal_level: number;
  created_at: string;
  revealed: any;
};

export default async function BestiaryPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) redirect("/auth/login");

  // Find this user's assigned character_id in this campaign
  const { data: cm, error: cmErr } = await supabase
    .from("campaign_members")
    .select("character_id,role")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (cmErr) {
    return (
      <main className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Bestiary</h1>
        <p className="text-sm text-red-600">Could not load membership: {cmErr.message}</p>
        <Link className="underline" href={`/app/c/${campaignId}`}>
          Back to campaign
        </Link>
      </main>
    );
  }

  const characterId = cm?.character_id as string | null;

  if (!characterId) {
    return (
      <main className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Bestiary</h1>
        <p className="text-sm text-gray-600">
          No character assigned to your account yet. Ask the DM to assign you a character on the Members page.
        </p>
        <Link className="underline" href={`/app/c/${campaignId}`}>
          Back to campaign
        </Link>
      </main>
    );
  }

  const { data: entries, error } = await supabase
    .from("bestiary_entries")
    .select("id,category,reveal_level,created_at,revealed")
    .eq("campaign_id", campaignId)
    .eq("character_id", characterId)
    .order("category", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Bestiary</h1>
        <Link className="underline text-sm" href={`/app/c/${campaignId}`}>
          Back to campaign
        </Link>
        <p className="text-xs text-gray-600">
          Shows only creatures the DM has pushed to your personal bestiary.
        </p>
      </header>

      {error && <p className="text-sm text-red-600">DB error: {error.message}</p>}

      {!error && (entries?.length ?? 0) === 0 && (
        <p className="text-sm text-gray-600">Nothing revealed to you yet.</p>
      )}

      <BestiaryClient entries={(entries ?? []) as EntryRow[]} />
    </main>
  );
}
