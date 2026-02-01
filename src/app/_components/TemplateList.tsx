"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CreateCollectionForm from "./CreateCollectionForm";

type Template = { id: string; name: string; version?: string };

type TemplateRow = {
  id: string; // newest template id for this (name, version)
  name: string;
  version: string;
  duplicateCount: number; // total templates in this group
};

const makeKey = (name: string, version: string) => `${name}|||${version}`;

export default function TemplateList() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();

    // Note: loading=true and error=null are already the initial states.
    // We only reset them here if this effect could re-run (e.g., with dependencies).

    fetch("/api/templates", { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          setTemplates([]);
          setError(json?.error || "Failed to load templates");
          return;
        }

        // supports { templates: [...] } and raw array
        const list = (json?.templates ?? json ?? []) as unknown;

        if (!Array.isArray(list)) {
          setTemplates([]);
          setError("Unexpected response shape from /api/templates");
          return;
        }

        // minimal runtime shaping
        const parsed: Template[] = list
          .map((t: unknown) => {
            const item = t as Record<string, unknown>;
            return {
              id: typeof item?.id === "string" ? item.id : "",
              name: typeof item?.name === "string" ? item.name : "",
              version:
                typeof item?.version === "string" ? item.version : undefined,
            };
          })
          .filter((t) => t.id && t.name);

        setTemplates(parsed);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setTemplates([]);
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  // Dedupe by (name, version). Assumes API returns newest-first.
  const rows = useMemo<TemplateRow[]>(() => {
    if (!templates) return [];

    const map = new Map<string, TemplateRow>();

    for (const t of templates) {
      const name = t.name.trim();
      const version = (t.version ?? "1").trim() || "1";
      const key = makeKey(name, version);

      const existing = map.get(key);
      if (!existing) {
        // first seen = newest (given API order)
        map.set(key, { id: t.id, name, version, duplicateCount: 1 });
      } else {
        existing.duplicateCount += 1;
      }
    }

    return Array.from(map.values());
  }, [templates]);

  if (loading) return <div className="text-sm">Loading templates...</div>;
  if (error) return <div className="text-xs text-rose-400">Error: {error}</div>;
  if (rows.length === 0)
    return <div className="text-sm text-slate-400">No templates found</div>;

  return (
    <div className="w-full max-w-xl space-y-3 mt-6">
      <h2 className="text-lg font-semibold">Templates</h2>

      <div className="space-y-2">
        {rows.map((t) => (
          <div
            key={t.id}
            className="border border-slate-800 rounded p-3 bg-slate-900"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{t.name}</div>
                <div className="text-xs text-slate-400">
                  v{t.version}
                  {t.duplicateCount > 1 ? (
                    <span className="text-slate-500">
                      {" "}
                      · {t.duplicateCount} copies
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                className="px-2 py-1 bg-indigo-600 rounded text-sm shrink-0"
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
              >
                {expanded === t.id ? "Cancel" : "Create Collection"}
              </button>
            </div>

            {expanded === t.id ? (
              <div className="mt-3">
                <CreateCollectionForm
                  templateId={t.id}
                  onCancel={() => setExpanded(null)}
                  onCreated={(id: string) => {
                    setExpanded(null);
                    router.push(`/collections/${id}`);
                  }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
