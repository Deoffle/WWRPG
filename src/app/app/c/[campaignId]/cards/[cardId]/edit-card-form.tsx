"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type Rarity = "common" | "rare" | "epic" | "legendary";
type EncounterType = "combat" | "exploration" | "both";

function browserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

function toInt(s: string, fallback = 0) {
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 80) || "card";
}

export default function EditCardForm({
  campaignId,
  card,
}: {
  campaignId: string;
  card: any;
}) {
  const router = useRouter();

  function safeStructured(x: any) {
    if (x && typeof x === "object") return x;
    if (typeof x === "string") {
      try {
        const parsed = JSON.parse(x);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  }

  // ...
  const structured = safeStructured(card?.structured);

  const [name, setName] = useState<string>(card?.name ?? "");
  const [rarity, setRarity] = useState<Rarity>(structured?.rarity ?? "common");
  const [encounterType, setEncounterType] = useState<EncounterType>(structured?.encounter_type ?? "both");
  const [maxOwned, setMaxOwned] = useState<string>(String(structured?.max_owned ?? 1));
  const [tags, setTags] = useState<string>((Array.isArray(card?.tags) ? card.tags : []).join(", "));
  const [description, setDescription] = useState<string>(structured?.description ?? "");

  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function uploadImage(cardId: string) {
    if (!file) return { imagePath: null as string | null };

    const ext = (file.name.split(".").pop() || "png").toLowerCase();

    // IMPORTANT: campaignId must be first folder to match Storage RLS
    const path = `${campaignId}/${cardId}-${Date.now()}-${safeFilename(file.name)}.${ext}`;

    const supabase = browserSupabase();
    const { error } = await supabase.storage.from("card-images").upload(path, file, {
      upsert: true,
      contentType: file.type || "image/png",
      cacheControl: "3600",
    });

    if (error) throw error;
    return { imagePath: path };
  }


  async function save() {
    setErr(null);
    setBusy(true);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setBusy(false);
      return setErr("Name is required.");
    }

    const tagArr = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    let imagePathPatch: any = {};

    try {
      if (file) {
        const { imagePath } = await uploadImage(card.id);
        imagePathPatch = { image_path: imagePath };
      }
    } catch (e: any) {
      setBusy(false);
      return setErr(`Image upload failed: ${e?.message ?? "Unknown error"}`);
    }

    const res = await fetch("/api/cards/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        cardId: card.id,
        name: trimmedName,
        tags: tagArr,
        structuredPatch: {
          rarity,
          encounter_type: encounterType,
          description,
          max_owned: toInt(maxOwned, 1),
          ...imagePathPatch,
        },
      }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) return setErr(json?.error ?? "Failed to save card.");

    setFile(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <div className="text-xs text-gray-600">Name</div>
          <input className="border rounded-md p-2 w-full" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="space-y-1">
          <div className="text-xs text-gray-600">Rarity</div>
          <select className="border rounded-md p-2 w-full" value={rarity} onChange={(e) => setRarity(e.target.value as Rarity)}>
            <option value="legendary">Legendary</option>
            <option value="epic">Epic</option>
            <option value="rare">Rare</option>
            <option value="common">Common</option>
          </select>
        </label>

        <label className="space-y-1">
          <div className="text-xs text-gray-600">Encounter type</div>
          <select
            className="border rounded-md p-2 w-full"
            value={encounterType}
            onChange={(e) => setEncounterType(e.target.value as EncounterType)}
          >
            <option value="both">Both</option>
            <option value="combat">Combat</option>
            <option value="exploration">Exploration</option>
          </select>
        </label>

        <label className="space-y-1">
          <div className="text-xs text-gray-600">Max owned</div>
          <input className="border rounded-md p-2 w-full" value={maxOwned} onChange={(e) => setMaxOwned(e.target.value)} inputMode="numeric" />
        </label>
      </div>

      <label className="space-y-1 block">
        <div className="text-xs text-gray-600">Tags (comma-separated)</div>
        <input className="border rounded-md p-2 w-full" value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>

      <label className="space-y-1 block">
        <div className="text-xs text-gray-600">Description</div>
        <textarea className="border rounded-md p-2 w-full" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <label className="block space-y-1">
        <div className="text-xs text-gray-600">Replace image (optional)</div>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div className="text-xs text-gray-500">Recommended aspect ratio: 785×1100.</div>
      </label>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <button
        className="border rounded-md px-3 py-2 disabled:opacity-50"
        type="button"
        disabled={busy}
        onClick={save}
      >
        {busy ? "Saving…" : "Save"}
      </button>

      <p className="text-xs text-gray-600">
        Note: this saves your new card fields into <span className="font-medium">cards.structured</span>.
      </p>
    </div>
  );
}
