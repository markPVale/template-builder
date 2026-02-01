// src/lib/analytics/formatMetricValue.ts
import type { MetricFormat } from "./runtime";

/**
 * Format a metric value for display based on its format type.
 */
export function formatMetricValue(
  value: number,
  format?: MetricFormat
): string {
  if (value == null || Number.isNaN(value)) return "—";

  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);

    case "percent":
      return new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value / 100); // Assume value is already in percentage form (e.g., 75 = 75%)

    case "number":
    default:
      // Use grouping for large numbers
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
  }
}
