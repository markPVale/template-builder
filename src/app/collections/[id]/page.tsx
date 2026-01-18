"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { TemplateSpec } from "@/lib/validation/template_spec";

type CollectionResponse = {
  collection: {
    id: string;
    name: string;
    activeVer: string;
    templateId: string;
    settings: Record<string, unknown> | null;
    template: {
      id: string;
      name: string;
      version: string;
      spec: TemplateSpec;
    };
  };
};

type RecordItem = {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export default function CollectionPage() {
  const params = useParams<{ id: string }>();
  const collectionId = params?.id;
  const [collection, setCollection] = useState<
    CollectionResponse["collection"] | null
  >(null);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const fields = useMemo(
    () => collection?.template.spec.schema.fields ?? [],
    [collection]
  );

  const loadCollection = async () => {
    if (!collectionId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [collectionRes, recordsRes] = await Promise.all([
        fetch(`/api/collections?id=${collectionId}`),
        fetch(`/api/records?collectionId=${collectionId}`),
      ]);
      const collectionJson = await collectionRes.json();
      const recordsJson = await recordsRes.json();
      if (!collectionRes.ok) {
        throw new Error(collectionJson?.error || "Failed to load collection");
      }
      if (!recordsRes.ok) {
        throw new Error(recordsJson?.error || "Failed to load records");
      }
      setCollection(collectionJson.collection);
      setRecords(recordsJson.records ?? []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollection();
  }, [collectionId]);

  const updateField = (id: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleCreateRecord = async () => {
    if (!collectionId || saving) {
      return;
    }

    // Validate required fields
    const errors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required) {
        const raw = formData[field.id];
        if (raw === undefined || raw === "" || raw === null) {
          errors[field.id] = `${field.label || field.id} is required`;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSaving(true);
    setError(null);
    setValidationErrors({});
    try {
      const payload: Record<string, unknown> = {};
      for (const field of fields) {
        const raw = formData[field.id];
        if (raw === undefined || raw === "") {
          continue;
        }
        if (field.type === "number") {
          const numberValue = Number(raw);
          if (!Number.isNaN(numberValue)) {
            payload[field.id] = numberValue;
          }
          continue;
        }
        if (field.type === "boolean") {
          payload[field.id] = Boolean(raw);
          continue;
        }
        payload[field.id] = raw;
      }

      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId,
          data: payload,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (Array.isArray(json?.details)) {
          const next: Record<string, string> = {};
          for (const d of json.details) {
            if (d?.field && d?.message) next[d.field] = d.message;
          }
          setValidationErrors(next);
          return;
        }
        throw new Error(json?.error || "Record creation failed");
      }
      setFormData({});
      setValidationErrors({});
      await loadCollection();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Record creation failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        Loading collection...
      </main>
    );
  }

  if (!collection) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        {error || "Collection not found."}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 space-y-6">
      <Link className="text-xs text-slate-300 underline" href="/">
        ← Back to home
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{collection.name}</h1>
        <div className="text-xs text-slate-300">
          Collection ID: {collection.id}
        </div>
        <div className="text-xs text-slate-300">
          Template: {collection.template.name} (v{collection.template.version})
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-900 p-4 space-y-2">
          <div className="text-sm font-semibold">Template Spec</div>
          <pre className="text-xs bg-slate-950 border border-slate-800 rounded p-3 overflow-auto max-h-96">
            {JSON.stringify(collection.template.spec, null, 2)}
          </pre>
        </div>

        <div className="rounded border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="text-sm font-semibold">Create Record</div>
          <div className="space-y-3">
            {fields.map((field) => {
              const value = formData[field.id];
              if (field.type === "boolean") {
                return (
                  <label
                    key={field.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(e) => updateField(field.id, e.target.checked)}
                    />
                    <span>
                      {field.label || field.id}
                      {field.required && (
                        <span className="text-rose-400"> *</span>
                      )}
                    </span>
                  </label>
                );
              }
              if (field.type === "select") {
                return (
                  <label key={field.id} className="text-xs block space-y-1">
                    <span>
                      {field.label || field.id}
                      {field.required && (
                        <span className="text-rose-400"> *</span>
                      )}
                    </span>
                    <select
                      className={`w-full rounded border p-2 ${
                        validationErrors[field.id]
                          ? "border-rose-500 bg-rose-950/20"
                          : "border-slate-700 bg-slate-950"
                      }`}
                      value={(value as string) ?? ""}
                      onChange={(e) => {
                        updateField(field.id, e.target.value);
                        if (validationErrors[field.id]) {
                          setValidationErrors((prev) => {
                            const next = { ...prev };
                            delete next[field.id];
                            return next;
                          });
                        }
                      }}
                    >
                      <option value="">Select...</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {validationErrors[field.id] && (
                      <span className="text-rose-400">
                        {validationErrors[field.id]}
                      </span>
                    )}
                  </label>
                );
              }
              return (
                <label key={field.id} className="text-xs block space-y-1">
                  <span>
                    {field.label || field.id}
                    {field.required && (
                      <span className="text-rose-400"> *</span>
                    )}
                  </span>
                  <input
                    className={`w-full rounded border p-2 ${
                      validationErrors[field.id]
                        ? "border-rose-500 bg-rose-950/20"
                        : "border-slate-700 bg-slate-950"
                    }`}
                    type={field.type === "number" ? "number" : "text"}
                    value={(value as string) ?? ""}
                    onChange={(e) => {
                      updateField(field.id, e.target.value);
                      if (validationErrors[field.id]) {
                        setValidationErrors((prev) => {
                          const next = { ...prev };
                          delete next[field.id];
                          return next;
                        });
                      }
                    }}
                  />
                  {validationErrors[field.id] && (
                    <span className="text-rose-400">
                      {validationErrors[field.id]}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <button
            onClick={handleCreateRecord}
            disabled={saving}
            className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm"
          >
            {saving ? "Saving..." : "Create Record"}
          </button>
          {error ? <div className="text-xs text-rose-400">{error}</div> : null}
        </div>
      </section>

      <section className="rounded border border-slate-800 bg-slate-900 p-4 space-y-3">
        <div className="text-sm font-semibold">Records</div>
        {records.length === 0 ? (
          <div className="text-xs text-slate-300">No records yet.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left border-b border-slate-800">
                  {fields.map((field) => (
                    <th key={field.id} className="py-2 pr-4">
                      {field.label || field.id}
                    </th>
                  ))}
                  <th className="py-2 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-slate-800">
                    {fields.map((field) => (
                      <td key={field.id} className="py-2 pr-4">
                        {String(record.data?.[field.id] ?? "")}
                      </td>
                    ))}
                    <td className="py-2 pr-4">
                      {new Date(record.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
