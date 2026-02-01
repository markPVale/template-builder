// src/lib/validation/template_spec.ts
import { z } from "zod";

/**
 * Fields (unchanged)
 */
export const Field = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    label: z.string().default(""),
    type: z.literal("string"),
    required: z.boolean().optional(),
  }),
  z.object({
    id: z.string(),
    label: z.string().optional(),
    type: z.literal("number"),
    min: z.number().optional(),
    max: z.number().optional(),
    required: z.boolean().optional(),
  }),
  z.object({
    id: z.string(),
    label: z.string().optional(),
    type: z.literal("boolean"),
    required: z.boolean().optional(),
  }),
  z.object({
    id: z.string(),
    label: z.string().optional(),
    type: z.literal("date"),
    required: z.boolean().optional(),
  }),
  z.object({
    id: z.string(),
    label: z.string().optional(),
    type: z.literal("select"),
    options: z.array(z.string()).min(1),
    required: z.boolean().optional(),
  }),
]);

/**
 * Shared view primitives
 */

const TimeRange = z.union([
  z.object({
    preset: z.enum(["this_month", "last_month", "this_year", "all_time"]),
  }),
  z.object({
    from: z.string(), // ISO date (YYYY-MM-DD) expected by convention
    to: z.string(),   // ISO date
  }),
]);

const Filter = z.discriminatedUnion("op", [
  z.object({
    fieldId: z.string(),
    op: z.literal("eq"),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
  z.object({
    fieldId: z.string(),
    op: z.literal("neq"),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
  z.object({
    fieldId: z.string(),
    op: z.literal("in"),
    value: z.array(z.union([z.string(), z.number()])),
  }),
  z.object({
    fieldId: z.string(),
    op: z.literal("gte"),
    value: z.number(),
  }),
  z.object({
    fieldId: z.string(),
    op: z.literal("lte"),
    value: z.number(),
  }),
  z.object({
    fieldId: z.string(),
    op: z.literal("contains"),
    value: z.string(),
  }),
]);

const MetricOp = z.enum(["sum", "count", "avg", "min", "max"]);
const MetricFormat = z.enum(["currency", "number", "percent"]);

const Metric = z
  .object({
    id: z.string(),
    label: z.string(),
    op: MetricOp,
    fieldId: z.string().optional(), // required for sum/avg/min/max (enforced below)
    format: MetricFormat.optional(),
    filters: z.array(Filter).optional(),
  })
  .superRefine((m, ctx) => {
    // Enforce fieldId presence for ops that require it
    if (m.op !== "count" && (!m.fieldId || m.fieldId.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `metric.fieldId is required when op is "${m.op}"`,
        path: ["fieldId"],
      });
    }
  });

const GroupBy = z.object({
  fieldId: z.string(),
  label: z.string().optional(),
  limit: z.number().int().positive().optional(),
  sort: z
    .object({
      metricId: z.string(),
      dir: z.enum(["asc", "desc"]),
    })
    .optional(),
});

/**
 * Views (new discriminated union)
 */

const FormView = z.object({
  id: z.string(),
  type: z.literal("form"),
  default: z.boolean().optional(),
});

const TableView = z.object({
  id: z.string(),
  type: z.literal("table"),
  columns: z.array(z.string()).optional(),
  default: z.boolean().optional(),
});

const SummaryView = z.object({
  id: z.string(),
  type: z.literal("summary"),
  default: z.boolean().optional(),

  timeFieldId: z.string().optional(),
  defaultTimeRange: TimeRange.optional(),

  metrics: z.array(Metric).min(1),
  groupBys: z.array(GroupBy).optional(),
  filters: z.array(Filter).optional(),
});

const ChartView = z.object({
  id: z.string(),
  type: z.literal("chart"),
  default: z.boolean().optional(),

  timeFieldId: z.string(),
  defaultTimeRange: TimeRange.optional(),
  interval: z.enum(["day", "week", "month"]).optional(),

  chartKind: z.enum(["line", "bar", "stacked_bar", "pie"]),

  series: z
    .array(
      z.object({
        metric: Metric,
        groupBy: GroupBy.optional(),
      })
    )
    .min(1),

  filters: z.array(Filter).optional(),
});

export const View = z.discriminatedUnion("type", [
  FormView,
  TableView,
  SummaryView,
  ChartView,
]);

export const TemplateSpec = z.object({
  name: z.string(),
  schema: z.object({
    fields: z.array(Field).min(1),
    indexes: z.array(z.array(z.string())).optional(),
  }),
  views: z.array(View).min(1),
});

export type TemplateSpec = z.infer<typeof TemplateSpec>;