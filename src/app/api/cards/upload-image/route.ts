import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeFilename(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const form = await req.formData();
  const campaignId = typeof form.get("campaignId") === "string" ? (form.get("campaignId") as string) : "";
  const cardId = typeof form.get("cardId") === "string" ? (form.get("cardId") as string) : "";
  const file = form.get("file");

  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  if (!cardId) return NextResponse.json({ error: "Missing cardId" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const base = safeFilename(file.name.replace(/\.[^.]+$/, "")); // remove extension
  const path = `${campaignId}/${cardId}-${Date.now()}-${base}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from("card-images").upload(path, bytes, {
    upsert: true,
    contentType: file.type || "image/png",
    cacheControl: "3600",
  });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  // If you store it inside cards.structured.image_path:
  const { data: card, error: readErr } = await supabase
    .from("cards")
    .select("structured")
    .eq("id", cardId)
    .eq("campaign_id", campaignId)
    .single();

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 400 });

  const structured = (card?.structured ?? {}) as any;
  const nextStructured = { ...structured, image_path: path };

  const { error: writeErr } = await supabase
    .from("cards")
    .update({ image_path: path, structured: nextStructured })
    .eq("id", cardId)
    .eq("campaign_id", campaignId);
    
  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, imagePath: path });
}
