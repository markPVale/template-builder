import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TemplateSpec } from "@/lib/validation/template_spec";
import type { TemplateSpec as TemplateSpecType } from "@/lib/validation/template_spec";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.prompt !== "string") {
    return NextResponse.json(
      { error: 'Invalid request body. "prompt" is required.' },
      { status: 400 }
    );
  }

  // TODO: replace with LLM output. For now, deterministic stub.
  const spec: TemplateSpecType = {
    name: "Budget Tracker",
    schema: {
      fields: [
        { id: "date", label: "Date", type: "date", required: true },
        {
          id: "description",
          label: "Description",
          type: "string",
          required: true,
        },
        {
          id: "category",
          label: "Category",
          type: "select",
          options: [
            "Housing",
            "Food",
            "Transport",
            "Utilities",
            "Fun",
            "Other",
          ],
          required: true,
        },
        {
          id: "amount",
          label: "Amount",
          type: "number",
          min: 0,
          required: true,
        },
        {
          id: "type",
          label: "Type",
          type: "select",
          options: ["Expense", "Income"],
          required: true,
        },
        { id: "notes", label: "Notes", type: "string" },
      ],
    },
    views: [
      { id: "form", type: "form", default: true },
      {
        id: "table",
        type: "table",
        columns: ["date", "description", "category", "amount", "type"],
      },
    ],
  };

  // Validate on the way out (paranoid but good for now)
  const parsed = TemplateSpec.parse(spec);

  // Persist Template + Collection
  const template = await prisma.template.create({
    data: {
      name: parsed.name,
      spec: parsed,
      version: "1.0.0",
    },
  });

  const collection = await prisma.collection.create({
    data: {
      name: `${parsed.name} (My Data)`,
      templateId: template.id,
      activeVer: template.version,
      settings: {},
    },
  });

  return NextResponse.json({
    message: "Assistant created a template + collection",
    prompt: body.prompt,
    templateId: template.id,
    collectionId: collection.id,
    spec: parsed,
  });
}
