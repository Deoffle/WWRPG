"use client";

export type Block = { name: string; text: string };

function clampStr(x: unknown, max: number) {
  return (typeof x === "string" ? x : "").slice(0, max);
}

function normalize(blocks: Block[]): Block[] {
  // Keep empties (so "Add" doesn't disappear). Just sanitize.
  return (Array.isArray(blocks) ? blocks : []).map((b) => ({
    name: clampStr(b?.name, 120),
    text: clampStr(b?.text, 2000),
  }));
}

export default function BlockListEditor({
  title,
  value,
  disabled,
  onChange,
}: {
  title: string;
  value: Block[];
  disabled?: boolean;
  onChange: (next: Block[]) => void;
}) {
  const rows = normalize(value);

  function update(i: number, patch: Partial<Block>) {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  }

  function add() {
    const next = [...rows, { name: "", text: "" }];
    onChange(next);
  }

  function remove(i: number) {
    const next = rows.filter((_, idx) => idx !== i);
    onChange(next);
  }

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">{title}</div>
        <button
          className="border rounded-md px-3 py-2"
          type="button"
          disabled={disabled}
          onClick={add}
        >
          Add
        </button>
      </div>

      {rows.length === 0 && <div className="text-sm text-gray-600">None yet.</div>}

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <input
                className="border rounded-md p-2 w-full"
                placeholder="Name"
                value={r.name}
                disabled={disabled}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <button
                className="border rounded-md px-3 py-2 text-red-600"
                type="button"
                disabled={disabled}
                onClick={() => remove(i)}
              >
                Remove
              </button>
            </div>

            <textarea
              className="border rounded-md p-2 w-full"
              rows={3}
              placeholder="Rules text"
              value={r.text}
              disabled={disabled}
              onChange={(e) => update(i, { text: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
