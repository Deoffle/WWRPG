import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CreateInviteCard from "./create-invite-card";
import AssignCharacterTable from "./assign-character-table";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/login");

  const { data: members, error: membersErr } = await supabase
    .from("campaign_members")
    .select("user_id,role,character_id,created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  const { data: characters, error: charactersErr } = await supabase
    .from("characters")
    .select("id,name,created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Members</h1>
        <Link className="underline text-sm" href={`/app/c/${campaignId}`}>
          Back to campaign
        </Link>
      </header>

      <CreateInviteCard campaignId={campaignId} />

      {membersErr && <p className="text-sm text-red-600">DB error: {membersErr.message}</p>}
      {charactersErr && <p className="text-sm text-red-600">DB error: {charactersErr.message}</p>}

      <AssignCharacterTable
        campaignId={campaignId}
        members={(members ?? []) as any}
        characters={(characters ?? []) as any}
      />

      <section className="space-y-2">
        <h2 className="font-medium">Current members</h2>
        <ul className="space-y-2">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="border rounded-lg p-3">
              <div className="font-medium">{m.role}</div>
              <div className="text-xs text-gray-500">user_id: {m.user_id}</div>
              <div className="text-xs text-gray-500">character_id: {m.character_id ?? "—"}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
