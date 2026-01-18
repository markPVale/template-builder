// src/lib/validation/template_spec.ts
import { z } from "zod";

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

export const TemplateSpec = z.object({
  name: z.string(),
  schema: z.object({
    fields: z.array(Field).min(1),
    indexes: z.array(z.array(z.string())).optional(),
  }),
  views: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["form", "table"]),
      columns: z.array(z.string()).optional(),
      default: z.boolean().optional(),
    })
  ),
});

export type TemplateSpec = z.infer<typeof TemplateSpec>;
