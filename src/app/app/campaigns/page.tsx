import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CreateCampaignForm from "./create-campaign-form";
import LogoutButton from "./logout-button";
import ImportCampaignCard from "./import-campaign-card";

export default async function CampaignsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) redirect("/auth/login");

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id,name,created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-sm text-gray-600">Logged in as {user.email}</p>
        </div>
        <LogoutButton />
      </header>

      {/* Create campaign */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Create campaign</h2>
        <CreateCampaignForm />
      </section>

      {/* Import (creates new campaign) */}
      <ImportCampaignCard />

      {/* List */}
      <section className="space-y-2">
        {error && <p className="text-sm text-red-600">DB error: {error.message}</p>}

        {!error && (campaigns?.length ?? 0) === 0 && (
          <p className="text-sm text-gray-600">No campaigns yet.</p>
        )}

        <ul className="space-y-2">
          {(campaigns ?? []).map((c) => (
            <li key={c.id} className="border rounded-lg p-3">
              <Link className="font-medium underline" href={`/app/c/${c.id}`}>
                {c.name}
              </Link>
              <div className="text-sm text-gray-600">{new Date(c.created_at).toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">id: {c.id}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
