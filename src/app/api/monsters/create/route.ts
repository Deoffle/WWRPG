import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function defaultMonsterData(name: string) {
  return {
    name,
    type: "",
    size: "",
    alignment: "",
    ac: null,
    hp: null,
    speed: "",
    imageUrl: null, // we'll fill later from Supabase Storage
    stats: { PHY: 10, MEN: 10, MAG: 10, INT: 10, DIP: 10, ICY: 10 },
    saves: [],
    skills: [],
    resistances: [],
    immunities: [],
    weaknesses: [],
    strengths: [],
    senses: "",
    languages: "",
    traits: [],
    actions: [],
    reactions: [],
    legendary_actions: [],
  };
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const tagsRaw = typeof body?.tags === "string" ? body.tags : "";

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Missing monster name" }, { status: 400 });

  const tags = tagsRaw
    .split(",")
    .map((t: string) => t.trim())
    .filter((t: string) => t.length > 0)
    .slice(0, 20);

  const { data: inserted, error } = await supabase
    .from("monsters")
    .insert({
      campaign_id: campaignId,
      name,
      tags,
      data: defaultMonsterData(name),
      gm_notes: "",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ id: inserted.id });
}
