import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import DeleteCampaignCard from "./delete-campaign-card";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/login");

  const { data: memberRow, error: memberErr } = await supabase
  .from("campaign_members")
  .select("role")
  .eq("campaign_id", campaignId)
  .eq("user_id", data.user.id)
  .maybeSingle();

if (memberErr) {
  // Optional: you can show an error instead, but this is fine
  // (it just means the DM link won't show)
}

const isDm = memberRow?.role === "dm";
const isPlayer = memberRow?.role === "player";


  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id,name")
    .eq("id", campaignId)
    .single();

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{campaign?.name ?? "Campaign"}</h1>

      <div className="grid gap-3 sm:grid-cols-1">
        {isDm ? (
          <Link className="border rounded-xl p-4 hover:bg-gray-50" href={`/app/c/${campaignId}/dm`}>
            <div className="font-medium">DM Screen</div>
            <div className="text-sm text-gray-600">Control encounters from here</div>          
          </Link>
        ) : null}

        {isPlayer ? (
          <Link className="border rounded-xl p-4 hover:bg-gray-50" href={`/app/c/${campaignId}/play`}>
            <div className="font-medium">Play</div>
            <div className="text-sm text-gray-600">Jump into the action!</div>          
          </Link>
        ) : null}

      </div>
      <div className="grid gap-3 sm:grid-cols-2">

        <Link className="border rounded-xl p-4 hover:bg-gray-50" href={`/app/c/${campaignId}/characters`}>
          <div className="font-medium">Characters</div>
          <div className="text-sm text-gray-600">Sheets, items, grades</div>
        </Link>

        <Link className="border rounded-xl p-4 hover:bg-gray-50" href={`/app/c/${campaignId}/cards`}>
          <div className="font-medium">Cards</div>
          <div className="text-sm text-gray-600">Spell/card library</div>
        </Link>

        <Link className="border rounded-xl p-4 hover:bg-gray-50" href={`/app/c/${campaignId}/decks`}>
          <div className="font-medium">Decks</div>
          <div className="text-sm text-gray-600">Combat + exploration decks</div>
        </Link>

        <Link
          className="border rounded-xl p-4 hover:bg-gray-50"
          href={`/app/c/${campaignId}/monsters`}
        >
          <div className="font-medium">Monsters</div>
          <div className="text-sm text-gray-600">DM bestiary + reveal to characters</div>
        </Link>

        <Link
          className="border rounded-xl p-4 hover:bg-gray-50"
          href={`/app/c/${campaignId}/bestiary`}
        >
          <div className="font-medium">Bestiary</div>
          <div className="text-sm text-gray-600">Your revealed creatures</div>
        </Link>


        <Link className="border rounded-xl p-4 hover:bg-gray-50" href={`/app/c/${campaignId}/members`}>
          <div className="font-medium">Members</div>
          <div className="text-sm text-gray-600">Invite links, roles</div>
        </Link>

        <Link className="border rounded-xl p-4 hover:bg-gray-50" href={`/app/c/${campaignId}/backup`}>
          <div className="font-medium">Backup</div>
          <div className="text-sm text-gray-600">Export / import campaign JSON</div>
        </Link>
      </div>

      <DeleteCampaignCard campaignId={campaignId} />

      <Link className="underline" href="/app/campaigns">
        Back to campaigns
      </Link>
    </main>
  );
}
