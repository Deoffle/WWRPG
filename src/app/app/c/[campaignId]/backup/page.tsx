import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BackupClient from "./backup-client";

export default async function BackupPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/login");

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Campaign backup</h1>
        <div className="flex gap-4 text-sm">
          <Link className="underline" href={`/app/c/${campaignId}`}>
            Back to campaign
          </Link>
        </div>
      </header>

      <section className="border rounded-xl p-4 space-y-3">
        <BackupClient campaignId={campaignId} />
      </section>
    </main>
  );
}
