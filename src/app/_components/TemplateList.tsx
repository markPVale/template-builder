"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CreateCollectionForm from "./CreateCollectionForm";

type Template = { id: string; name: string; version?: string };

export default function TemplateList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/templates", { signal: controller.signal });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          setTemplates([]);
          setError(json?.error || "Failed to load templates");
          return;
        }

        // Support both { templates: [...] } and raw array.
        const raw = (json?.templates ?? json) as unknown;

        const next: Template[] = Array.isArray(raw)
          ? raw
              .filter((t) => t && typeof t === "object")
              .map((t: any) => ({
                id: String(t.id),
                name: String(t.name ?? "Untitled"),
                version:
                  t.version == null ? undefined : String(t.version),
              }))
          : [];

        setTemplates(next);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setTemplates([]);
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, []);

  if (loading) return <div className="text-sm">Loading templates...</div>;
  if (error) return <div className="text-xs text-rose-400">Error: {error}</div>;
  if (templates.length === 0)
    return <div className="text-sm text-slate-400">No templates found</div>;

  return (
    <div className="w-full max-w-xl space-y-3 mt-6">
      <h2 className="text-lg font-semibold">Templates</h2>

      <div className="space-y-2">
        {templates.map((t) => (
          <div
            key={t.id}
            className="border border-slate-800 rounded p-3 bg-slate-900"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{t.name}</div>
                <div className="text-xs text-slate-400">
                  v{t.version ?? "1.0.0"}
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