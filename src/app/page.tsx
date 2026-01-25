"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TemplateList from "./_components/TemplateList";

export default function HomePage() {
  const router = useRouter();

  const [prompt, setPrompt] = useState("I need a budget tracker");
  const [response, setResponse] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const [seedLoading, setSeedLoading] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [showSeed, setShowSeed] = useState(true);

  const handleGenerate = async () => {
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const json = await res.json().catch(() => null);

      // If/when the assistant returns a created collection id, go straight there.
      if (res.ok && json?.collectionId) {
        router.push(`/collections/${json.collectionId}`);
        return;
      }

      setResponse(json);
    } catch (err) {
      console.error(err);
      setResponse({ error: "Request failed" });
    } finally {
      setLoading(false);
    }
  };

  const seedSpec = {
    name: "Seed Budget Tracker",
    schema: {
      fields: [
        { id: "date", label: "Date", type: "date", required: true },
        {
          id: "description",
          label: "Description",
          type: "string",
          required: true,
        },
        {
          id: "category",
          label: "Category",
          type: "select",
          options: [
            "Housing",
            "Food",
            "Transport",
            "Utilities",
            "Fun",
            "Other",
          ],
        },
        { id: "amount", label: "Amount", type: "number", required: true },
        {
          id: "type",
          label: "Type",
          type: "select",
          options: ["Expense", "Income"],
          required: true,
        },
        { id: "notes", label: "Notes", type: "string" },
      ],
      indexes: [["date"], ["category"]],
    },
    views: [
      { id: "form", type: "form", default: true },
      {
        id: "table",
        type: "table",
        columns: ["date", "description", "category", "amount", "type"],
        default: true,
      },
    ],
  };

  const handleSeedBudgetTracker = async () => {
    if (seedLoading) return;

    setSeedLoading(true);
    setSeedError(null);

    try {
      const templateRes = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: seedSpec.name, spec: seedSpec }),
      });

      const templateJson = await templateRes.json().catch(() => null);
      if (!templateRes.ok) {
        throw new Error(templateJson?.error || "Template creation failed");
      }

      const templateId = templateJson?.template?.id;
      if (!templateId) {
        throw new Error("Template creation succeeded but no template id returned");
      }

      const collectionRes = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Seed Budget Tracker",
          templateId,
        }),
      });

      const collectionJson = await collectionRes.json().catch(() => null);
      if (!collectionRes.ok) {
        throw new Error(collectionJson?.error || "Collection creation failed");
      }

      const collectionId = collectionJson?.collection?.id;
      if (!collectionId) {
        throw new Error(
          "Collection creation succeeded but no collection id returned"
        );
      }

      // Seed should behave like the primary UX: create + redirect.
      router.push(`/collections/${collectionId}`);
    } catch (err) {
      console.error(err);
      setSeedError(err instanceof Error ? err.message : "Seed action failed");
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-8">
      <h1 className="text-2xl font-semibold mb-4">AI Template Builder – MVP</h1>

      <div className="w-full max-w-xl space-y-4">
        <textarea
          className="w-full rounded border border-slate-700 bg-slate-900 p-3 text-sm"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate TemplateSpec"}
        </button>

        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Seed Budget Tracker</div>
          <label className="text-xs flex items-center gap-2">
            <input
              type="checkbox"
              checked={showSeed}
              onChange={(e) => setShowSeed(e.target.checked)}
            />
            <span>Show seed</span>
          </label>
        </div>

        {showSeed ? (
          <div className="rounded border border-slate-800 bg-slate-900 p-4 space-y-2">
            <div className="text-xs text-slate-300">
              Creates a Template + Collection and takes you to the collection view.
            </div>

            <button
              onClick={handleSeedBudgetTracker}
              disabled={seedLoading}
              className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm"
            >
              {seedLoading ? "Seeding..." : "Seed Budget Tracker"}
            </button>

            {seedError ? (
              <div className="text-xs text-rose-400">{seedError}</div>
            ) : null}
          </div>
        ) : null}

        <TemplateList />

        <pre className="mt-4 text-xs bg-slate-900 border border-slate-800 rounded p-3 overflow-auto max-h-96">
          {response ? JSON.stringify(response, null, 2) : "// no response yet"}
        </pre>
      </div>
    </main>
  );
}