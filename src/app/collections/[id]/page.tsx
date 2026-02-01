"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

  // View + debug state
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [savingView, setSavingView] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const specViews = useMemo(() => {
    return collection?.template.spec.views ?? [];
  }, [collection]);

  const defaultView = useMemo(() => {
    if (!specViews.length) return null;
    return specViews.find((v) => v.default) ?? specViews[0];
  }, [specViews]);

  // Initialize active view from DB settings first, else fall back to default
  useEffect(() => {
    if (!collection) return;
    if (activeViewId) return;

    const fromSettings = (collection.settings as Record<string, unknown> | null)
      ?.activeView;

    if (typeof fromSettings === "string" && fromSettings.length > 0) {
      setActiveViewId(fromSettings);
      return;
    }

    if (defaultView) {
      setActiveViewId(defaultView.id);
    }
  }, [collection, defaultView, activeViewId]);

  const activeView = useMemo(() => {
    if (!activeViewId) return null;
    return specViews.find((v) => v.id === activeViewId) ?? null;
  }, [specViews, activeViewId]);

  const fields = useMemo(
    () => collection?.template.spec.schema.fields ?? [],
    [collection],
  );

  // Set default date values to today
  useEffect(() => {
    if (!fields.length) return;

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const dateDefaults: Record<string, string> = {};

    for (const field of fields) {
      if (field.type === "date" && !formData[field.id]) {
        dateDefaults[field.id] = today;
      }
    }

    if (Object.keys(dateDefaults).length > 0) {
      setFormData((prev) => ({ ...prev, ...dateDefaults }));
    }
  }, [fields, formData]);

  // Columns for table view
  const tableColumns = useMemo(() => {
    if (activeView?.type !== "table") return null;
    // If columns omitted, fall back to all fields
    return activeView.columns ?? fields.map((f) => f.id);
  }, [activeView, fields]);

  const visibleTableFields = useMemo(() => {
    if (!tableColumns) return [];
    const allow = new Set(tableColumns);
    // Only show columns that exist in schema (ignore unknown)
    return fields.filter((f) => allow.has(f.id));
  }, [fields, tableColumns]);

  const clearFieldError = (fieldId: string) => {
    if (!validationErrors[fieldId]) return;
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  const updateField = (id: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
    clearFieldError(id);
  };

  const loadCollection = useCallback(
    async (signal?: AbortSignal) => {
      if (!collectionId) return;

      setLoading(true);
      setError(null);

      try {
        const [collectionRes, recordsRes] = await Promise.all([
          fetch(`/api/collections?id=${collectionId}`, { signal }),
          fetch(`/api/records?collectionId=${collectionId}`, { signal }),
        ]);

        const collectionJson = await collectionRes.json().catch(() => null);
        const recordsJson = await recordsRes.json().catch(() => null);

        if (!collectionRes.ok) {
          throw new Error(collectionJson?.error || "Failed to load collection");
        }
        if (!recordsRes.ok) {
          throw new Error(recordsJson?.error || "Failed to load records");
        }

        setCollection(collectionJson.collection);
        setRecords(recordsJson.records ?? []);

        // If server has a persisted activeView, align state (optional but helpful)
        const fromSettings = (
          collectionJson.collection?.settings as Record<string, unknown> | null
        )?.activeView;

        if (typeof fromSettings === "string" && fromSettings.length > 0) {
          setActiveViewId(fromSettings);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        setLoading(false);
      }
    },
    [collectionId],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadCollection(controller.signal);
    return () => controller.abort();
  }, [loadCollection]);

  const persistActiveView = async (nextViewId: string) => {
    if (!collectionId) return;
    if (savingView) return;

    const prev = activeViewId;
    setActiveViewId(nextViewId); // optimistic
    setSavingView(true);
    setError(null);

    try {
      const res = await fetch("/api/collections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: collectionId, activeView: nextViewId }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        // rollback optimistic update
        setActiveViewId(prev ?? null);

        if (Array.isArray(json?.details)) {
          const msg = json.details
            .map((d: { message?: string }) => d?.message)
            .filter(Boolean)
            .join(", ");
          throw new Error(msg || json?.error || "Failed to persist view");
        }

        throw new Error(json?.error || "Failed to persist view");
      }

      // Keep local settings in sync (recommended)
      setCollection((curr) => {
        if (!curr) return curr;
        const priorSettings =
          (curr.settings as Record<string, unknown> | null) ?? {};
        return {
          ...curr,
          settings: {
            ...priorSettings,
            activeView: nextViewId,
          },
        };
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to persist view");
    } finally {
      setSavingView(false);
    }
  };

  const handleCreateRecord = async () => {
    if (!collectionId || saving) return;

    // Client-side validation: required + number parsing
    const errors: Record<string, string> = {};

    for (const field of fields) {
      const raw = formData[field.id];

      // Required
      if (field.required) {
        if (raw === undefined || raw === "" || raw === null) {
          errors[field.id] = `${field.label || field.id} is required`;
          continue;
        }
      }

      // Number sanity (only validate if present)
      if (
        field.type === "number" &&
        raw !== undefined &&
        raw !== "" &&
        raw !== null
      ) {
        const numberValue = Number(raw);
        if (Number.isNaN(numberValue)) {
          errors[field.id] = `${field.label || field.id} must be a number`;
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
      // Build payload with basic coercions
      const payload: Record<string, unknown> = {};

      for (const field of fields) {
        const raw = formData[field.id];

        if (raw === undefined || raw === "" || raw === null) {
          continue;
        }

        if (field.type === "number") {
          const numberValue = Number(raw);
          if (!Number.isNaN(numberValue)) payload[field.id] = numberValue;
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
        body: JSON.stringify({ collectionId, data: payload }),
      });

      const json = await res.json().catch(() => null);

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

        {/* View switcher + debug toggle */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            {specViews.map((v) => {
              const isActive = v.id === activeViewId;
              return (
                <button
                  key={v.id}
                  onClick={() => persistActiveView(v.id)}
                  disabled={savingView}
                  className={`text-xs px-2 py-1 rounded border ${
                    isActive
                      ? "bg-indigo-600 border-indigo-500"
                      : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                  } ${savingView ? "opacity-60 cursor-not-allowed" : ""}`}
                  title={
                    savingView
                      ? "Saving view..."
                      : isActive
                        ? "Active view"
                        : "Switch view"
                  }
                >
                  {v.type}
                </button>
              );
            })}
          </div>

          <label className="text-xs flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={showDebug}
              onChange={(e) => setShowDebug(e.target.checked)}
            />
            <span>Debug</span>
          </label>
        </div>
      </header>

      {error ? <div className="text-xs text-rose-400">{error}</div> : null}

      {/* Debug only */}
      {showDebug ? (
        <section className="rounded border border-slate-800 bg-slate-900 p-4 space-y-2">
          <div className="text-sm font-semibold">Template Spec</div>
          <pre className="text-xs bg-slate-950 border border-slate-800 rounded p-3 overflow-auto max-h-96">
            {JSON.stringify(collection.template.spec, null, 2)}
          </pre>
        </section>
      ) : null}

      {/* VIEW: FORM */}
      {activeView?.type === "form" ? (
        <section className="rounded border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="text-sm font-semibold">Create Record</div>

          <div className="space-y-3">
            {fields.map((field) => {
              const value = formData[field.id];

              const label = (
                <span>
                  {field.label || field.id}
                  {field.required ? (
                    <span className="text-rose-400"> *</span>
                  ) : null}
                </span>
              );

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
                    {label}
                    {validationErrors[field.id] ? (
                      <span className="text-rose-400 ml-2">
                        {validationErrors[field.id]}
                      </span>
                    ) : null}
                  </label>
                );
              }

              if (field.type === "select") {
                return (
                  <label key={field.id} className="text-xs block space-y-1">
                    {label}
                    <select
                      className={`w-full rounded border p-2 ${
                        validationErrors[field.id]
                          ? "border-rose-500 bg-rose-950/20"
                          : "border-slate-700 bg-slate-950"
                      }`}
                      value={(value as string) ?? ""}
                      onChange={(e) => updateField(field.id, e.target.value)}
                    >
                      <option value="">Select...</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {validationErrors[field.id] ? (
                      <span className="text-rose-400">
                        {validationErrors[field.id]}
                      </span>
                    ) : null}
                  </label>
                );
              }

              const inputType =
                field.type === "number"
                  ? "number"
                  : field.type === "date"
                    ? "date"
                    : "text";

              return (
                <label key={field.id} className="text-xs block space-y-1">
                  {label}
                  <input
                    className={`w-full rounded border p-2 ${
                      validationErrors[field.id]
                        ? "border-rose-500 bg-rose-950/20"
                        : "border-slate-700 bg-slate-950"
                    }`}
                    type={inputType}
                    value={(value as string) ?? ""}
                    onChange={(e) => updateField(field.id, e.target.value)}
                  />
                  {validationErrors[field.id] ? (
                    <span className="text-rose-400">
                      {validationErrors[field.id]}
                    </span>
                  ) : null}
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
        </section>
      ) : null}

      {/* VIEW: TABLE */}
      {activeView?.type === "table" ? (
        <section className="rounded border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="text-sm font-semibold">Records</div>

          {records.length === 0 ? (
            <div className="text-xs text-slate-300">No records yet.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left border-b border-slate-800">
                    {visibleTableFields.map((field) => (
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
                      {visibleTableFields.map((field) => (
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
      ) : null}

      {/* If a template has no views, give a helpful message */}
      {!activeView ? (
        <section className="rounded border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs text-rose-400">
            This template has no views configured in spec.views.
          </div>
        </section>
      ) : null}
    </main>
  );
}
