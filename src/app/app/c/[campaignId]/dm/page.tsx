import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import DmClient from "./dm-client";

export default async function DmPage({
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

  if (memberErr) notFound();
  if (memberRow?.role !== "dm") notFound();

  return <DmClient campaignId={campaignId} />;
}
