// src/app/_components/views/ChartView.tsx
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

// Extract ChartView type from the union
type ChartViewSpec = Extract<
  TemplateSpec["views"][number],
  { type: "chart" }
>;

type Props = {
  specView: ChartViewSpec;
  records: RecordLike[];
  fields: TemplateSpec["schema"]["fields"];
  timeRange: TimeRange | null;
  totalRecordCount: number;
  onSwitchToForm: () => void;
  onChangeTimeRange: (range: TimeRange | null) => void;
};

export default function ChartView({
  specView,
  records,
  fields,
  timeRange,
  totalRecordCount,
  onSwitchToForm,
  onChangeTimeRange,
}: Props) {
  // Apply time range and filters
  const filteredRecords = useMemo(() => {
    let result = records;

    // Apply time range (timeFieldId is required for chart views)
    if (timeRange) {
      result = applyTimeRange(
        result,
        specView.timeFieldId,
        timeRange
      );
    }

    // Apply view-level filters
    if (specView.filters?.length) {
      result = applyFilters(result, specView.filters);
    }

    return result;
  }, [records, timeRange, specView.timeFieldId, specView.filters]);

  // Compute series data
  // For MVP: render as tables. Real charts (Recharts) can be added later.
  const seriesData = useMemo(() => {
    return specView.series.map((s, idx) => {
      const { metric, groupBy } = s;

      if (groupBy) {
        // Grouped metric (for pie/bar charts)
        const field = fields.find((f) => f.id === groupBy.fieldId);
        const fieldLabel = groupBy.label || field?.label || groupBy.fieldId;

        const rows = computeGroupedMetric({
          records: filteredRecords,
          groupBy,
          metric,
        });

        return {
          id: `series-${idx}`,
          type: "grouped" as const,
          metric,
          groupBy,
          fieldLabel,
          rows,
        };
      } else {
        // Single metric value
        const value = computeMetric(filteredRecords, metric);

        return {
          id: `series-${idx}`,
          type: "single" as const,
          metric,
          value,
        };
      }
    });
  }, [filteredRecords, specView.series, fields]);

  const chartKindLabel = {
    line: "Line Chart",
    bar: "Bar Chart",
    stacked_bar: "Stacked Bar Chart",
    pie: "Pie Chart",
  }[specView.chartKind];

  // Empty state: no records at all
  if (totalRecordCount === 0) {
    return (
      <section className="rounded border border-slate-800 bg-slate-900 p-4">
        <div className="text-sm font-semibold mb-4">
          {chartKindLabel}
          <span className="text-xs text-slate-400 ml-2">(data preview)</span>
        </div>
        <div className="text-center py-8">
          <div className="text-slate-400 mb-2">No records yet</div>
          <button
            onClick={onSwitchToForm}
            className="text-indigo-400 hover:text-indigo-300 text-sm"
          >
            Add your first record →
          </button>
        </div>
      </section>
    );
  }

  // Empty state: records exist but filtered to zero
  if (filteredRecords.length === 0) {
    return (
      <section className="rounded border border-slate-800 bg-slate-900 p-4">
        <div className="text-sm font-semibold mb-4">
          {chartKindLabel}
          <span className="text-xs text-slate-400 ml-2">(data preview)</span>
        </div>
        <div className="text-center py-8">
          <div className="text-slate-400 mb-2">
            No records match the current filters
          </div>
          <div className="text-xs text-slate-500">
            {totalRecordCount} record{totalRecordCount !== 1 ? "s" : ""} total •{" "}
            <button
              onClick={() => onChangeTimeRange({ preset: "all_time" })}
              className="text-indigo-400 hover:text-indigo-300"
            >
              Show all time
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded border border-slate-800 bg-slate-900 p-4 space-y-4">
      <div className="text-sm font-semibold">
        {chartKindLabel}
        <span className="text-xs text-slate-400 ml-2">(data preview)</span>
      </div>

      {/* Pseudo-chart: render data as tables for MVP */}
      {seriesData.map((series) => {
        if (series.type === "single") {
          // Single metric card
          return (
            <div
              key={series.id}
              className="rounded border border-slate-700 bg-slate-800 p-3"
            >
              <div className="text-xs text-slate-400 mb-1">
                {series.metric.label}
              </div>
              <div className="text-xl font-semibold">
                {formatMetricValue(series.value, series.metric.format)}
              </div>
            </div>
          );
        }

        // Grouped data table (placeholder for bar/pie chart)
        return (
          <div key={series.id} className="space-y-2">
            <div className="text-xs text-slate-400">
              {series.metric.label} by {series.fieldLabel}
            </div>

            {series.rows.length === 0 ? (
              <div className="text-xs text-slate-500">No data</div>
            ) : (
              <>
                {/* Visual bar representation for bar/pie */}
                {(specView.chartKind === "bar" ||
                  specView.chartKind === "pie") && (
                  <div className="space-y-1">
                    {series.rows.map((row) => {
                      const maxValue = Math.max(
                        ...series.rows.map((r) => r.value)
                      );
                      const percentage =
                        maxValue > 0 ? (row.value / maxValue) * 100 : 0;

                      return (
                        <div key={row.key} className="flex items-center gap-2">
                          <div className="w-24 text-xs truncate">{row.key}</div>
                          <div className="flex-1 h-4 bg-slate-700 rounded overflow-hidden">
                            <div
                              className="h-full bg-indigo-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="w-20 text-xs text-right">
                            {formatMetricValue(row.value, series.metric.format)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Data table */}
                <div className="overflow-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-left border-b border-slate-700">
                        <th className="py-2 pr-4">{series.fieldLabel}</th>
                        <th className="py-2 pr-4 text-right">
                          {series.metric.label}
                        </th>
                        <th className="py-2 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {series.rows.map((row) => (
                        <tr key={row.key} className="border-b border-slate-800">
                          <td className="py-2 pr-4">{row.key}</td>
                          <td className="py-2 pr-4 text-right">
                            {formatMetricValue(row.value, series.metric.format)}
                          </td>
                          <td className="py-2 text-right">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
