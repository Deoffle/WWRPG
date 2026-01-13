"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MonsterImageUploader from "./monster-image-uploader";
import BlockListEditor, { type Block } from "./block-list-editor";

type CharacterRow = { id: string; name: string };

type Monster = {
  id: string;
  name: string;
  tags: string[];
  gm_notes: string | null;
  data: any;
};

const defaultStats = { PHY: 10, MEN: 10, MAG: 10, INT: 10, DIP: 10, ICY: 10 };

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function splitCsv(input: string, limit: number) {
  return input
    .split(",")
    .map((t: string) => t.trim())
    .filter((t: string) => t.length > 0)
    .slice(0, limit);
}

function normBlocks(x: any): Block[] {
  if (!Array.isArray(x)) return [];
  return x
    .map((it: any) => ({
      name: typeof it?.name === "string" ? it.name : "",
      text: typeof it?.text === "string" ? it.text : "",
    }))
    .filter((b: Block) => b.name.trim() || b.text.trim());
}

export default function MonsterEditor({
  campaignId,
  monster,
  characters,
}: {
  campaignId: string;
  monster: Monster;
  characters: CharacterRow[];
}) {
  const router = useRouter();

  const initial = useMemo(() => {
    const d = monster.data ?? {};
    const sheet = d.sheet ?? {};

    const resistArr = Array.isArray(sheet.resistances)
      ? sheet.resistances
      : Array.isArray(d.resistances)
        ? d.resistances
        : [];

    const immArr = Array.isArray(sheet.immunities)
      ? sheet.immunities
      : Array.isArray(d.immunities)
        ? d.immunities
        : [];

    return {
      name: monster.name ?? "Monster",
      tags: (monster.tags ?? []).join(", "),
      imageUrl: d.imageUrl ?? "",
      type: d.type ?? "",
      size: d.size ?? "",
      alignment: d.alignment ?? "",
      ac: d.ac ?? "",
      hp: d.hp ?? "",
      speed: d.speed ?? "",
      strengths: Array.isArray(d.strengths) ? d.strengths.join(", ") : "",
      weaknesses: Array.isArray(d.weaknesses) ? d.weaknesses.join(", ") : "",
      resistances: Array.isArray(resistArr) ? resistArr.join(", ") : "",
      immunities: Array.isArray(immArr) ? immArr.join(", ") : "",
      senses: d.senses ?? "",
      languages: d.languages ?? "",
      gm_notes: monster.gm_notes ?? "",
      stats: { ...defaultStats, ...(d.stats ?? {}) },

      description: typeof sheet.description === "string" ? sheet.description : "",
      traits: normBlocks(sheet.traits),
      actions: normBlocks(sheet.actions),
      reactions: normBlocks(sheet.reactions),
      legendary_actions: normBlocks(sheet.legendary_actions),
    };
  }, [monster]);

  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Push controls
  const [pushAllCharacters, setPushAllCharacters] = useState(false);
  const [pushSkipNpc, setPushSkipNpc] = useState(true);
  const [pushCharacterId, setPushCharacterId] = useState(characters[0]?.id ?? "");
  const [pushCategory, setPushCategory] = useState("Unsorted");
  const [pushLevel, setPushLevel] = useState("1");

  async function updateMonster(patch: any) {
    setErr(null);
    setOkMsg(null);
    setBusy(true);

    const res = await fetch("/api/monsters/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, monsterId: monster.id, patch }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to save monster.");
      return false;
    }

    setOkMsg("Saved.");
    router.refresh();
    return true;
  }

  async function saveAll() {
    const name = form.name.trim();
    if (!name) return setErr("Name cannot be empty.");

    const tagsArr = splitCsv(form.tags, 20);
    const strengthsArr = splitCsv(form.strengths, 50);
    const weaknessesArr = splitCsv(form.weaknesses, 50);
    const resistArr = splitCsv(form.resistances, 50);
    const immArr = splitCsv(form.immunities, 50);

    const data = {
      ...(monster.data ?? {}),
      imageUrl: form.imageUrl || null,
      type: form.type,
      size: form.size,
      alignment: form.alignment,
      ac: form.ac === "" ? null : toNum(String(form.ac)),
      hp: form.hp === "" ? null : toNum(String(form.hp)),
      speed: form.speed,
      strengths: strengthsArr,
      weaknesses: weaknessesArr,
      senses: form.senses,
      languages: form.languages,
      stats: {
        PHY: toNum(String(form.stats.PHY)),
        MEN: toNum(String(form.stats.MEN)),
        MAG: toNum(String(form.stats.MAG)),
        INT: toNum(String(form.stats.INT)),
        DIP: toNum(String(form.stats.DIP)),
        ICY: toNum(String(form.stats.ICY)),
      },
      sheet: {
        ...(monster.data?.sheet ?? {}),
        description: form.description ?? "",
        resistances: resistArr,
        immunities: immArr,
        traits: form.traits ?? [],
        actions: form.actions ?? [],
        reactions: form.reactions ?? [],
        legendary_actions: form.legendary_actions ?? [],
      },
    };

    await updateMonster({
      name,
      tags: tagsArr,
      gm_notes: form.gm_notes,
      data,
    });
  }

  async function deleteMonster() {
    if (!confirm("Delete this monster? This cannot be undone.")) return;

    setErr(null);
    setBusy(true);

    const res = await fetch("/api/monsters/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, monsterId: monster.id }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to delete monster.");
      return;
    }

    router.push(`/app/c/${campaignId}/monsters`);
    router.refresh();
  }

  async function pushToBestiary() {
    setErr(null);
    setOkMsg(null);

    const lvl = Number(pushLevel);
    if (![1, 2, 3].includes(lvl)) return setErr("Reveal level must be 1, 2, or 3.");

    if (!pushAllCharacters && !pushCharacterId) return setErr("Pick a character (or push to all).");

    setBusy(true);
    const res = await fetch("/api/bestiary/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        monsterId: monster.id,
        characterId: pushAllCharacters ? null : pushCharacterId,
        category: pushCategory,
        revealLevel: lvl,
        allCharacters: pushAllCharacters,
        skipNpc: pushSkipNpc,
      }),
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setErr(json?.error ?? "Failed to push to bestiary.");
      return;
    }

    setOkMsg(
      pushAllCharacters
        ? `Pushed to bestiary (${json?.count ?? "?"} characters).`
        : "Pushed to bestiary."
    );
  }

  return (
    <div className="space-y-6">
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Monster sheet</h2>

        {err && <p className="text-sm text-red-600">{err}</p>}
        {okMsg && <p className="text-sm text-green-700">{okMsg}</p>}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-gray-600">Name</label>
            <input
              className="border rounded-md p-2 w-full"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Tags (comma-separated)</label>
            <input
              className="border rounded-md p-2 w-full"
              value={form.tags}
              onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="sm:col-span-2 border rounded-lg p-3 space-y-2">
            <div className="font-medium">Image</div>

            <MonsterImageUploader
              campaignId={campaignId}
              monsterId={monster.id}
              currentUrl={form.imageUrl}
              onUploaded={async (url) => {
                setForm((p) => ({ ...p, imageUrl: url }));
                const nextData = { ...(monster.data ?? {}), imageUrl: url };
                await updateMonster({ data: nextData });
              }}
            />

            <p className="text-xs text-gray-600">Uploading saves automatically.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Type</label>
            <input
              className="border rounded-md p-2 w-full"
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Size</label>
            <input
              className="border rounded-md p-2 w-full"
              value={form.size}
              onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Alignment</label>
            <input
              className="border rounded-md p-2 w-full"
              value={form.alignment}
              onChange={(e) => setForm((p) => ({ ...p, alignment: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">AC</label>
            <input
              className="border rounded-md p-2 w-full"
              value={String(form.ac)}
              onChange={(e) => setForm((p) => ({ ...p, ac: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">HP</label>
            <input
              className="border rounded-md p-2 w-full"
              value={String(form.hp)}
              onChange={(e) => setForm((p) => ({ ...p, hp: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-gray-600">Speed</label>
            <input
              className="border rounded-md p-2 w-full"
              value={form.speed}
              onChange={(e) => setForm((p) => ({ ...p, speed: e.target.value }))}
              disabled={busy}
            />
          </div>
        </div>

        <div className="border rounded-lg p-3 space-y-2">
          <div className="font-medium">Stats</div>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-6">
            {(["PHY", "MEN", "MAG", "INT", "DIP", "ICY"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <label className="text-xs text-gray-600">{k}</label>
                <input
                  className="border rounded-md p-2 w-full"
                  value={String(form.stats[k])}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      stats: { ...p.stats, [k]: e.target.value },
                    }))
                  }
                  disabled={busy}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-gray-600">Strengths (comma-separated)</label>
            <input
              className="border rounded-md p-2 w-full"
              value={form.strengths}
              onChange={(e) => setForm((p) => ({ ...p, strengths: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Weaknesses (comma-separated)</label>
            <input
              className="border rounded-md p-2 w-full"
              value={form.weaknesses}
              onChange={(e) => setForm((p) => ({ ...p, weaknesses: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Resistances (comma-separated)</label>
            <input
              className="border rounded-md p-2 w-full"
              value={form.resistances}
              onChange={(e) => setForm((p) => ({ ...p, resistances: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Immunities (comma-separated)</label>
            <input
              className="border rounded-md p-2 w-full"
              value={form.immunities}
              onChange={(e) => setForm((p) => ({ ...p, immunities: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Senses</label>
            <input
              className="border rounded-md p-2 w-full"
              value={form.senses}
              onChange={(e) => setForm((p) => ({ ...p, senses: e.target.value }))}
              disabled={busy}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Languages</label>
            <input
              className="border rounded-md p-2 w-full"
              value={form.languages}
              onChange={(e) => setForm((p) => ({ ...p, languages: e.target.value }))}
              disabled={busy}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-600">Description</label>
          <textarea
            className="border rounded-md p-2 w-full"
            rows={4}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            disabled={busy}
          />
        </div>

        <BlockListEditor
          title="Traits"
          value={form.traits}
          disabled={busy}
          onChange={(next) => setForm((p) => ({ ...p, traits: next }))}
        />
        <BlockListEditor
          title="Actions"
          value={form.actions}
          disabled={busy}
          onChange={(next) => setForm((p) => ({ ...p, actions: next }))}
        />
        <BlockListEditor
          title="Reactions"
          value={form.reactions}
          disabled={busy}
          onChange={(next) => setForm((p) => ({ ...p, reactions: next }))}
        />
        <BlockListEditor
          title="Legendary actions"
          value={form.legendary_actions}
          disabled={busy}
          onChange={(next) => setForm((p) => ({ ...p, legendary_actions: next }))}
        />

        <div className="space-y-1">
          <label className="text-xs text-gray-600">GM notes</label>
          <textarea
            className="border rounded-md p-2 w-full"
            rows={3}
            value={form.gm_notes}
            onChange={(e) => setForm((p) => ({ ...p, gm_notes: e.target.value }))}
            disabled={busy}
          />
        </div>

        <div className="flex gap-2">
          <button className="border rounded-md px-3 py-2" type="button" disabled={busy} onClick={saveAll}>
            {busy ? "Saving…" : "Save"}
          </button>

          <button className="border rounded-md px-3 py-2 text-red-600" type="button" disabled={busy} onClick={deleteMonster}>
            Delete
          </button>
        </div>
      </section>

      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Push to character bestiary</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="border rounded-lg p-3 flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={pushAllCharacters}
              onChange={(e) => setPushAllCharacters(e.target.checked)}
              disabled={busy}
            />
            <div>
              <div className="font-medium">Push to all characters</div>
              <div className="text-xs text-gray-600">
                Sends/updates this creature for every character in the campaign.
              </div>
            </div>
          </label>

          <label className="border rounded-lg p-3 flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={pushSkipNpc}
              onChange={(e) => setPushSkipNpc(e.target.checked)}
              disabled={busy || !pushAllCharacters}
            />
            <div>
              <div className="font-medium">Skip NPC characters</div>
              <div className="text-xs text-gray-600">
                When pushing to all, ignores characters where <code>characters.sheet.isNpc</code> is true.
              </div>
            </div>
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 items-start">
          <div className="space-y-1">
            <label className="text-xs text-gray-600">Character</label>
            <select
              className="border rounded-md p-2 w-full"
              value={pushCharacterId}
              onChange={(e) => setPushCharacterId(e.target.value)}
              disabled={busy || pushAllCharacters}
            >
              <option value="">Select character…</option>
              {characters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {pushAllCharacters && (
              <div className="text-xs text-gray-600">Disabled because “Push to all characters” is enabled.</div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Category</label>
            <input
              className="border rounded-md p-2 w-full"
              value={pushCategory}
              onChange={(e) => setPushCategory(e.target.value)}
              disabled={busy}
            />
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                className="border rounded-md px-3 py-1 text-sm"
                disabled={busy}
                onClick={() => setPushCategory("Creatures")}
              >
                Creatures
              </button>
              <button
                type="button"
                className="border rounded-md px-3 py-1 text-sm"
                disabled={busy}
                onClick={() => setPushCategory("Humanoids")}
              >
                Humanoids
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-600">Reveal level</label>
            <select
              className="border rounded-md p-2 w-full"
              value={pushLevel}
              onChange={(e) => setPushLevel(e.target.value)}
              disabled={busy}
            >
              <option value="1">1 — Image only</option>
              <option value="2">2 — Image + strengths/weaknesses</option>
              <option value="3">3 — Full sheet</option>
            </select>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="border rounded-md px-3 py-1 text-sm"
                disabled={busy}
                onClick={() => setPushLevel("1")}
              >
                L1
              </button>
              <button
                type="button"
                className="border rounded-md px-3 py-1 text-sm"
                disabled={busy}
                onClick={() => setPushLevel("2")}
              >
                L2
              </button>
              <button
                type="button"
                className="border rounded-md px-3 py-1 text-sm"
                disabled={busy}
                onClick={() => setPushLevel("3")}
              >
                L3
              </button>
            </div>
          </div>
        </div>

        <button
          className="border rounded-md px-3 py-2"
          type="button"
          disabled={busy}
          onClick={pushToBestiary}
        >
          {busy ? "Pushing…" : pushAllCharacters ? "Push / Update all" : "Push / Update"}
        </button>

        <p className="text-xs text-gray-600">
          This writes a redacted snapshot into the character’s bestiary entry (based on reveal level).
        </p>
      </section>
    </div>
  );
}
