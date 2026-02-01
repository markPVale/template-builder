// src/app/_components/views/SummaryView.tsx
"use client";

import { useMemo } from "react";
import type { TemplateSpec } from "@/lib/validation/template_spec";
import {
  applyTimeRange,
  applyFilters,
  computeMetric,
  computeGroupedMetric,
  type RecordLike,
  type TimeRange,
} from "@/lib/analytics/runtime";
import { formatMetricValue } from "@/lib/analytics/formatMetricValue";

// Extract SummaryView type from the union
type SummaryViewSpec = Extract<
  TemplateSpec["views"][number],
  { type: "summary" }
>;

type Props = {
  specView: SummaryViewSpec;
  records: RecordLike[];
  fields: TemplateSpec["schema"]["fields"];
  timeRange: TimeRange | null;
  totalRecordCount: number; // total records before any filtering
  onSwitchToForm?: () => void;
};

export default function SummaryView({
  specView,
  records,
  fields,
  timeRange,
  totalRecordCount,
  onSwitchToForm,
}: Props) {
  // Apply time range and filters
  const filteredRecords = useMemo(() => {
    let result = records;

    // Apply time range
    if (timeRange && specView.timeFieldId) {
      result = applyTimeRange(result, specView.timeFieldId, timeRange);
    }

    // Apply view-level filters
    if (specView.filters?.length) {
      result = applyFilters(result, specView.filters);
    }

    return result;
  }, [records, timeRange, specView.timeFieldId, specView.filters]);

  // Compute all metrics
  const metricValues = useMemo(() => {
    return specView.metrics.map((metric) => ({
      metric,
      value: computeMetric(filteredRecords, metric),
    }));
  }, [filteredRecords, specView.metrics]);

  // Compute grouped breakdowns
  const groupedData = useMemo(() => {
    if (!specView.groupBys?.length) return [];

    return specView.groupBys.map((groupBy) => {
      // Use the first metric for grouping value (or find by sort.metricId)
      const metricForGrouping =
        specView.metrics.find((m) => m.id === groupBy.sort?.metricId) ??
        specView.metrics[0];

      const rows = computeGroupedMetric({
        records: filteredRecords,
        groupBy,
        metric: metricForGrouping,
      });

      // Get field label for display
      const field = fields.find((f) => f.id === groupBy.fieldId);
      const fieldLabel = groupBy.label || field?.label || groupBy.fieldId;

      return {
        groupBy,
        fieldLabel,
        metric: metricForGrouping,
        rows,
      };
    });
  }, [filteredRecords, specView.groupBys, specView.metrics, fields]);

  // Empty state: no records at all in collection
  if (totalRecordCount === 0) {
    return (
      <section className="rounded border border-slate-800 bg-slate-900 p-6 text-center space-y-3">
        <div className="text-sm font-medium">No records yet</div>
        <div className="text-xs text-slate-400">
          Create your first record in the Form view.
        </div>
        {onSwitchToForm ? (
          <button
            onClick={onSwitchToForm}
            className="text-xs px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500"
          >
            Go to Form
          </button>
        ) : null}
      </section>
    );
  }

  // Empty state: records exist but none match filters/time range
  if (filteredRecords.length === 0) {
    return (
      <section className="rounded border border-slate-800 bg-slate-900 p-6 text-center space-y-3">
        <div className="text-sm font-medium">No results for this time range</div>
        <div className="text-xs text-slate-400">
          Try expanding the range or clearing filters.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded border border-slate-800 bg-slate-900 p-4 space-y-4">
      <div className="text-sm font-semibold">Summary</div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {metricValues.map(({ metric, value }) => (
          <div
            key={metric.id}
            className="rounded border border-slate-700 bg-slate-800 p-3"
          >
            <div className="text-xs text-slate-400 mb-1">{metric.label}</div>
            <div className="text-xl font-semibold">
              {formatMetricValue(value, metric.format)}
            </div>
          </div>
        ))}
      </div>

      {/* Grouped Breakdowns */}
      {groupedData.map(({ groupBy, fieldLabel, metric, rows }) => (
        <div key={groupBy.fieldId} className="space-y-2">
          <div className="text-xs text-slate-400">By {fieldLabel}</div>

          {rows.length === 0 ? (
            <div className="text-xs text-slate-500">No data</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left border-b border-slate-700">
                    <th className="py-2 pr-4">{fieldLabel}</th>
                    <th className="py-2 pr-4 text-right">{metric.label}</th>
                    <th className="py-2 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-b border-slate-800">
                      <td className="py-2 pr-4">{row.key}</td>
                      <td className="py-2 pr-4 text-right">
                        {formatMetricValue(row.value, metric.format)}
                      </td>
                      <td className="py-2 text-right">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
