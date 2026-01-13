"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function extFromFile(file: File) {
  const lower = file.name.toLowerCase();
  const parts = lower.split(".");
  if (parts.length > 1) return parts.pop()!;
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export default function MonsterImageUploader({
  campaignId,
  monsterId,
  currentUrl,
  onUploaded,
}: {
  campaignId: string;
  monsterId: string;
  currentUrl: string;
  onUploaded: (url: string) => void;
}) {
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setErr(null);

    if (!file.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Image too large (max 5MB).");
      return;
    }

    const ext = extFromFile(file);
    const path = `${campaignId}/${monsterId}/cover.${ext}`;

    setBusy(true);

    const { error: upErr } = await supabase.storage
      .from("monsters")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      setBusy(false);
      setErr(upErr.message);
      return;
    }

    const { data } = supabase.storage.from("monsters").getPublicUrl(path);
    setBusy(false);

    onUploaded(data.publicUrl);
  }

  return (
    <div className="space-y-2">
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUrl}
          alt="Monster"
          className="w-full max-h-[240px] object-contain rounded-lg border bg-white"
        />
      ) : (
        <div className="w-full h-40 rounded-lg border flex items-center justify-center text-sm text-gray-600">
          No image yet
        </div>
      )}

      <input
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.currentTarget.value = "";
        }}
      />

      {busy && <p className="text-sm text-gray-600">Uploading…</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
