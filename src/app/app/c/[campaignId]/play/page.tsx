import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PlayClient from "./play-client";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/login");

  // Single ownership source: characters.user_id
  const { data: character, error } = await supabase
    .from("characters")
    .select("id,name")
    .eq("campaign_id", campaignId)
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (error) {
    return (
      <main className="p-6">
        <p className="text-sm text-red-600">DB error: {error.message}</p>
      </main>
    );
  }

  if (!character) {
    return (
      <main className="p-6 space-y-2">
        <h1 className="text-2xl font-semibold">Play</h1>
        <p className="text-sm text-gray-600">
          No character is assigned to your user in this campaign.
        </p>
      </main>
    );
  }

  return (
    <PlayClient
      campaignId={campaignId}
      characterId={character.id}
      characterName={character.name ?? "Your character"}
    />
  );
}
