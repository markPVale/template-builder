// src/lib/analytics/runtime.ts
// MVP analytics runtime for TemplateSpec summary/chart views.
// Goals:
// - Pure functions (no DB, no fetch)
// - Small supported surface area:
//   - TimeRange presets: all_time, this_month, last_month, this_year
//   - Filter ops: eq, neq, in, gte, lte, contains
//   - Metric ops: sum, count, avg, min, max
//
// Notes:
// - Records are assumed to look like { data: { [fieldId]: unknown }, createdAt?: string }
// - timeFieldId expects record.data[timeFieldId] to be either:
//   - ISO date string "YYYY-MM-DD" (recommended), or
//   - any Date-parseable string
// - For charts you’ll typically:
//   1) applyTimeRange
//   2) applyFilters
//   3) groupBy
//   4) computeMetric per group

export type Primitive = string | number | boolean;

export type TimeRange =
  | { preset: "this_month" | "last_month" | "this_year" | "all_time" }
  | { from: string; to: string }; // ISO dates expected (YYYY-MM-DD)

export type Filter =
  | { fieldId: string; op: "eq"; value: Primitive }
  | { fieldId: string; op: "neq"; value: Primitive }
  | { fieldId: string; op: "in"; value: Array<string | number> }
  | { fieldId: string; op: "gte"; value: number }
  | { fieldId: string; op: "lte"; value: number }
  | { fieldId: string; op: "contains"; value: string };

export type MetricOp = "sum" | "count" | "avg" | "min" | "max";
export type MetricFormat = "currency" | "number" | "percent";

export type Metric = {
  id: string;
  label: string;
  op: MetricOp;
  fieldId?: string; // required for sum/avg/min/max by spec validation
  format?: MetricFormat;
  filters?: Filter[];
};

export type GroupBy = {
  fieldId: string;
  label?: string;
  limit?: number;
  sort?: { metricId: string; dir: "asc" | "desc" };
};

export type RecordLike = {
  data: Record<string, unknown>;
  createdAt?: string;
};

/**
 * Public API
 */

export function applyTimeRange(
  records: RecordLike[],
  timeFieldId: string | undefined,
  range: TimeRange | undefined,
  now: Date = new Date()
): RecordLike[] {
  if (!range) return records;
  if (!timeFieldId || timeFieldId.trim().length === 0) return records;

  const [start, endExclusive] = resolveTimeRange(range, now);
  if (!start || !endExclusive) return records;

  return records.filter((r) => {
    const d = getRecordDate(r, timeFieldId);
    if (!d) return false;
    return d >= start && d < endExclusive;
  });
}

export function applyFilters(records: RecordLike[], filters?: Filter[]): RecordLike[] {
  if (!filters || filters.length === 0) return records;
  return records.filter((r) => filters.every((f) => matchesFilter(r, f)));
}

export function computeMetric(records: RecordLike[], metric: Metric): number {
  const filtered = metric.filters?.length ? applyFilters(records, metric.filters) : records;

  if (metric.op === "count") {
    return filtered.length;
  }

  const fieldId = metric.fieldId;
  if (!fieldId) return 0;

  const values: number[] = [];
  for (const r of filtered) {
    const raw = r.data?.[fieldId];
    const n = toNumber(raw);
    if (n !== null) values.push(n);
  }

  if (values.length === 0) return 0;

  switch (metric.op) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    default:
      return 0;
  }
}

export function groupByField(records: RecordLike[], fieldId: string): Map<string, RecordLike[]> {
  const map = new Map<string, RecordLike[]>();
  for (const r of records) {
    const key = normalizeGroupKey(r.data?.[fieldId]);
    const arr = map.get(key);
    if (arr) arr.push(r);
    else map.set(key, [r]);
  }
  return map;
}

/**
 * Convenience for charting:
 * Returns [{ key, value, count }] where value is metric(metricField) per group.
 */
export function computeGroupedMetric(params: {
  records: RecordLike[];
  groupBy: GroupBy;
  metric: Metric;
}): Array<{ key: string; value: number; count: number }> {
  const { records, groupBy, metric } = params;

  const grouped = groupByField(records, groupBy.fieldId);
  let rows = Array.from(grouped.entries()).map(([key, groupRecords]) => {
    return {
      key,
      value: computeMetric(groupRecords, metric),
      count: groupRecords.length,
    };
  });

  // Optional sort by metric value
  const dir = groupBy.sort?.dir ?? "desc";
  rows.sort((a, b) => (dir === "asc" ? a.value - b.value : b.value - a.value));

  // Optional limit
  if (typeof groupBy.limit === "number" && groupBy.limit > 0) {
    rows = rows.slice(0, groupBy.limit);
  }

  return rows;
}

/**
 * Helpers
 */

function matchesFilter(record: RecordLike, filter: Filter): boolean {
  const raw = record.data?.[filter.fieldId];

  switch (filter.op) {
    case "eq":
      return looselyEqual(raw, filter.value);
    case "neq":
      return !looselyEqual(raw, filter.value);
    case "in": {
      const v = normalizeComparable(raw);
      if (v === null) return false;
      return filter.value.some((x) => String(x) === String(v));
    }
    case "gte": {
      const n = toNumber(raw);
      return n !== null && n >= filter.value;
    }
    case "lte": {
      const n = toNumber(raw);
      return n !== null && n <= filter.value;
    }
    case "contains": {
      const s = raw == null ? "" : String(raw);
      return s.toLowerCase().includes(filter.value.toLowerCase());
    }
    default:
      return true;
  }
}

function resolveTimeRange(range: TimeRange, now: Date): [Date | null, Date | null] {
  // We treat the interval as [start, endExclusive)
  if ("from" in range && "to" in range) {
    const start = parseDate(range.from);
    const end = parseDate(range.to);
    if (!start || !end) return [null, null];
    // endExclusive should be end + 1 day (so "to" is inclusive by convention)
    const endExclusive = addDays(startOfDay(end), 1);
    return [startOfDay(start), endExclusive];
  }

  switch (range.preset) {
    case "all_time":
      return [new Date(0), new Date(8640000000000000)]; // min/max-ish
    case "this_month": {
      const start = startOfMonth(now);
      const endExclusive = startOfMonth(addMonths(now, 1));
      return [start, endExclusive];
    }
    case "last_month": {
      const start = startOfMonth(addMonths(now, -1));
      const endExclusive = startOfMonth(now);
      return [start, endExclusive];
    }
    case "this_year": {
      const start = startOfYear(now);
      const endExclusive = startOfYear(addYears(now, 1));
      return [start, endExclusive];
    }
    default:
      return [null, null];
  }
}

function getRecordDate(record: RecordLike, timeFieldId: string): Date | null {
  const raw = record.data?.[timeFieldId];
  if (raw == null) return null;

  if (raw instanceof Date) return startOfDay(raw);

  // Most likely "YYYY-MM-DD"
  const d = parseDate(String(raw));
  if (!d) return null;

  return startOfDay(d);
}

function parseDate(s: string): Date | null {
  // If it's "YYYY-MM-DD", force local date at midnight
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (m) {
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    const day = Number(m[3]);
    const d = new Date(year, monthIndex, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function addYears(d: Date, years: number): Date {
  return new Date(d.getFullYear() + years, 0, 1);
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function looselyEqual(a: unknown, b: Primitive): boolean {
  // We want "Expense" == "Expense" and 5 == "5" for simple UX
  if (a == null) return false;
  if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b);
  return String(a) === String(b);
}

function normalizeComparable(raw: unknown): string | number | null {
  if (raw == null) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return raw;
  if (typeof raw === "boolean") return raw ? "true" : "false";
  return String(raw);
}

function normalizeGroupKey(raw: unknown): string {
  if (raw == null || raw === "") return "(empty)";
  const v = normalizeComparable(raw);
  return v == null ? "(empty)" : String(v);
}