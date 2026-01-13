import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CreateCardForm from "./create-card-form";
import CardsLibrary from "./cards-library";

type Structured = {
  rarity?: "common" | "rare" | "epic" | "legendary";
  encounter_type?: "combat" | "exploration" | "both";
  description?: string;
  max_owned?: number;
  image_path?: string | null;
};

type CardRow = {
  id: string;
  campaign_id: string;
  name: string;
  tags: string[] | null;
  structured: any;
  created_at: string;
  updated_at: string;
};

type CardUi = {
  id: string;
  name: string;
  tags: string[];
  rarity: "common" | "rare" | "epic" | "legendary";
  encounter_type: "combat" | "exploration" | "both";
  description: string;
  max_owned: number;
  image_path: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

function safeStructured(x: any): Structured {
  if (!x) return {};
  if (typeof x === "object") return x as Structured;

  if (typeof x === "string") {
    try {
      const once = JSON.parse(x);
      if (once && typeof once === "object") return once as Structured;
      if (typeof once === "string") {
        const twice = JSON.parse(once);
        if (twice && typeof twice === "object") return twice as Structured;
      }
    } catch {}
  }

  return {};
}


async function withSignedImageUrls(supabase: any, cards: CardUi[], expiresSeconds = 60 * 60) {
  const tasks = cards.map(async (c) => {
    if (!c.image_path) return c;

    const { data, error } = await supabase.storage
      .from("card-images")
      .createSignedUrl(c.image_path, expiresSeconds);

    if (error || !data?.signedUrl) return { ...c, image_url: null };
    return { ...c, image_url: data.signedUrl };
  });

  return Promise.all(tasks);
}

export default async function CardsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth/login");

  // (Optional) detect DM for UI messaging
  const { data: cm } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const isDm = (cm as any)?.role === "dm";

  const { data: cardsRaw, error } = await supabase
    .from("cards")
    .select("id,campaign_id,name,tags,structured,created_at,updated_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  const cards = ((cardsRaw ?? []) as unknown as CardRow[]).map((c) => {
    const s = safeStructured(c.structured);

    const rarity =
      s.rarity === "legendary" || s.rarity === "epic" || s.rarity === "rare" || s.rarity === "common"
        ? s.rarity
        : "common";

    const encounter_type =
      s.encounter_type === "combat" || s.encounter_type === "exploration" || s.encounter_type === "both"
        ? s.encounter_type
        : "both";

    const max_owned = Number.isFinite(Number(s.max_owned)) ? Math.max(0, Math.trunc(Number(s.max_owned))) : 1;

    return {
      id: c.id,
      name: c.name,
      tags: Array.isArray(c.tags) ? (c.tags as any).filter((t: any) => typeof t === "string") : [],
      rarity,
      encounter_type,
      description: typeof s.description === "string" ? s.description : "",
      max_owned,
      image_path: typeof s.image_path === "string" ? s.image_path : null,
      image_url: null,
      created_at: c.created_at,
      updated_at: c.updated_at,
    } satisfies CardUi;
  });

  const cardsWithUrls = await withSignedImageUrls(supabase, cards);

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Cards</h1>
        <Link className="underline text-sm" href={`/app/c/${campaignId}`}>
          Back to campaign
        </Link>
      </header>

      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Create card (DM)</h2>
        <CreateCardForm campaignId={campaignId} />
        <p className="text-xs text-gray-600">
          {isDm
            ? "You are DM for this campaign."
            : "If you’re not DM, creation/edit will be blocked by RLS."}
        </p>
      </section>

      <section className="space-y-2">
        {error && <p className="text-sm text-red-600">DB error: {error.message}</p>}

        {!error && cardsWithUrls.length === 0 && (
          <p className="text-sm text-gray-600">No cards yet.</p>
        )}

        {!error ? <CardsLibrary campaignId={campaignId} cards={cardsWithUrls} /> : null}
      </section>
    </main>
  );
}
