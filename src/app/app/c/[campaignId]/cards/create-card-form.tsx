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

export default function CreateCardForm({ campaignId }: { campaignId: string }) {
  if (!campaignId) {
    return <p className="text-sm text-red-600">DEBUG: campaignId prop is missing</p>;
  }


  const router = useRouter();

  const [name, setName] = useState("");
  const [rarity, setRarity] = useState<Rarity>("common");
  const [encounterType, setEncounterType] = useState<EncounterType>("both");
  const [maxOwned, setMaxOwned] = useState("1");
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");

  const [file, setFile] = useState<File | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function uploadImage(cardId: string) {
    if (!file) return { imagePath: null as string | null };

    const fd = new FormData();
    fd.append("campaignId", campaignId);
    fd.append("cardId", cardId);
    fd.append("file", file);

    const res = await fetch("/api/cards/upload-image", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(json?.error ?? "Upload failed");
    return { imagePath: json.imagePath as string };
  }



  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const trimmedName = name.trim();
    if (!trimmedName) return setErr("Enter a card name.");

    const tagArr = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setLoading(true);

    // 1) create card row first
    const res = await fetch("/api/cards/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        name: trimmedName,
        tags: tagArr,
        structured: {
          rarity,
          encounter_type: encounterType,
          description,
          max_owned: toInt(maxOwned, 1),
          image_path: null,
        },
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      return setErr(json?.error ?? "Failed to create card.");
    }

    const cardId = String(json?.id || "");
    if (!cardId) {
      setLoading(false);
      return setErr("Card created but no id returned.");
    }

    // 2) optional image upload, then update structured.image_path
    try {
      if (file) {
        const { imagePath } = await uploadImage(cardId);

        await fetch("/api/cards/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId,
            cardId,
            name: trimmedName,
            tags: tagArr,
            structuredPatch: { image_path: imagePath },
          }),
        });
      }
    } catch (e: any) {
      setErr(`Card created, but image upload failed: ${e?.message ?? "Unknown error"}`);
    }

    setLoading(false);

    setName("");
    setRarity("common");
    setEncounterType("both");
    setMaxOwned("1");
    setTags("");
    setDescription("");
    setFile(null);

    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <div className="text-xs text-gray-600">Name</div>
          <input
            className="border rounded-md p-2 w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="space-y-1">
          <div className="text-xs text-gray-600">Rarity</div>
          <select
            className="border rounded-md p-2 w-full"
            value={rarity}
            onChange={(e) => setRarity(e.target.value as Rarity)}
          >
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
          <input
            className="border rounded-md p-2 w-full"
            value={maxOwned}
            onChange={(e) => setMaxOwned(e.target.value)}
            inputMode="numeric"
          />
        </label>
      </div>

      <label className="space-y-1 block">
        <div className="text-xs text-gray-600">Tags (comma-separated)</div>
        <input
          className="border rounded-md p-2 w-full"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </label>

      <label className="space-y-1 block">
        <div className="text-xs text-gray-600">Description</div>
        <textarea
          className="border rounded-md p-2 w-full"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <label className="block space-y-1">
        <div className="text-xs text-gray-600">Card image (optional)</div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="text-xs text-gray-500">Recommended aspect ratio: 785×1100.</div>
      </label>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <button className="border rounded-md px-3 py-2" disabled={loading}>
        {loading ? "Creating…" : "Create card"}
      </button>

      <p className="text-xs text-gray-600">
        Note: this saves card fields into <span className="font-medium">cards.structured</span>.
      </p>
    </form>
  );
}
