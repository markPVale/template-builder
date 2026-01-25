"use client";

import { useState } from "react";

export default function CreateCollectionForm({
  templateId,
  onCancel,
  onCreated,
}: {
  templateId: string;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (saving) return;

    setError(null);

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Name is required");
      return;
    }
    if (trimmed.length > 100) {
      setError("Name must be 100 characters or fewer");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, templateId }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Create failed");
      }

      const id = json?.collection?.id;
      if (!id) throw new Error("No collection id returned");

      onCreated(id);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void handleCreate();
      }}
    >
      <input
        className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-sm"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError(null);
        }}
        placeholder="Collection name"
        disabled={saving}
        autoFocus
      />

      <div className="flex gap-2">
        <button
          type="submit"
          className="px-3 py-1 rounded bg-emerald-600 disabled:opacity-50 text-sm"
          disabled={saving}
        >
          {saving ? "Creating..." : "Create"}
        </button>

        <button
          type="button"
          className="px-3 py-1 rounded bg-slate-700 text-sm disabled:opacity-50"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>

      {error ? <div className="text-xs text-rose-400">{error}</div> : null}
    </form>
  );
}