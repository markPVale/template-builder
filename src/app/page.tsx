"use client";

import { useState } from "react";

export default function HomePage() {
  const [prompt, setPrompt] = useState("I need a budget tracker");
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedCollectionId, setSeedCollectionId] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();

      // Redirect to the created collection
      if (res.ok && json?.collectionId) {
        window.location.href = `/collections/${json.collectionId}`;
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
    setSeedLoading(true);
    setSeedError(null);
    setSeedCollectionId(null);
    try {
      const templateRes = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: seedSpec.name, spec: seedSpec }),
      });
      const templateJson = await templateRes.json();
      if (!templateRes.ok) {
        throw new Error(templateJson?.error || "Template creation failed");
      }

      const collectionRes = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Seed Budget Tracker",
          templateId: templateJson.template.id,
        }),
      });
      const collectionJson = await collectionRes.json();
      if (!collectionRes.ok) {
        throw new Error(collectionJson?.error || "Collection creation failed");
      }

      setSeedCollectionId(collectionJson.collection.id);
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

        <div className="rounded border border-slate-800 bg-slate-900 p-4 space-y-2">
          <div className="text-sm font-semibold">Seed Budget Tracker</div>
          <p className="text-xs text-slate-300">
            Creates a Template + Collection and links you to the collection
            view.
          </p>
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
          {seedCollectionId ? (
            <a
              className="text-xs text-emerald-300 underline"
              href={`/collections/${seedCollectionId}`}
            >
              View collection {seedCollectionId}
            </a>
          ) : null}
        </div>

        <pre className="mt-4 text-xs bg-slate-900 border border-slate-800 rounded p-3 overflow-auto max-h-96">
          {response ? JSON.stringify(response, null, 2) : "// no response yet"}
        </pre>
      </div>
    </main>
  );
}
