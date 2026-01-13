import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/login");

  const { data: campaignId, error } = await supabase.rpc("accept_campaign_invite", {
    p_code: code,
  });

  if (error || !campaignId) {
    return (
      <main className="p-6 space-y-2">
        <h1 className="text-2xl font-semibold">Invite</h1>
        <p className="text-sm text-red-600">
          Could not accept invite: {error?.message ?? "Unknown error"}
        </p>
      </main>
    );
  }

  redirect(`/app/c/${campaignId}`);
}
