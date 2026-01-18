import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { TemplateSpec as TemplateSpecType } from "@/lib/validation/template_spec";

type ValidationDetail = { field: string; message: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidISODateYYYYMMDD(value: string): boolean {
  // Basic format check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  // Stronger check (reject 2026-99-99, etc.)
  const d = new Date(value + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;

  // Ensure date round-trips
  const [y, m, day] = value.split("-").map((x) => Number(x));
  return (
    d.getUTCFullYear() === y &&
    d.getUTCMonth() + 1 === m &&
    d.getUTCDate() === day
  );
}

function validateAndNormalizeRecordData(
  spec: TemplateSpecType,
  rawData: unknown
): { ok: true; data: Record<string, unknown> } | { ok: false; details: ValidationDetail[] } {
  if (!isPlainObject(rawData)) {
    return {
      ok: false,
      details: [{ field: "_", message: "data must be an object" }],
    };
  }

  const fields = spec.schema.fields;
  const allowedIds = new Set(fields.map((f) => f.id));

  const details: ValidationDetail[] = [];
  const normalized: Record<string, unknown> = {};

  // Reject unknown keys (prevents silent garbage in JSON column)
  for (const key of Object.keys(rawData)) {
    if (!allowedIds.has(key)) {
      details.push({
        field: key,
        message: `Unknown field "${key}" for this template`,
      });
    }
  }

  for (const field of fields) {
    const value = rawData[field.id];

    const isMissing =
      value === undefined || value === null || value === "";

    if (field.required && isMissing) {
      details.push({
        field: field.id,
        message: `${field.label ?? field.id} is required`,
      });
      continue;
    }

    // If optional and missing, just skip
    if (isMissing) {
      continue;
    }

    switch (field.type) {
      case "string": {
        if (typeof value !== "string") {
          details.push({
            field: field.id,
            message: `${field.label ?? field.id} must be a string`,
          });
          break;
        }
        normalized[field.id] = value;
        break;
      }

      case "number": {
        const n =
          typeof value === "number" ? value :
          typeof value === "string" ? Number(value) :
          NaN;

        if (Number.isNaN(n)) {
          details.push({
            field: field.id,
            message: `${field.label ?? field.id} must be a number`,
          });
          break;
        }

        if (field.min !== undefined && n < field.min) {
          details.push({
            field: field.id,
            message: `${field.label ?? field.id} must be >= ${field.min}`,
          });
          break;
        }

        if (field.max !== undefined && n > field.max) {
          details.push({
            field: field.id,
            message: `${field.label ?? field.id} must be <= ${field.max}`,
          });
          break;
        }

        normalized[field.id] = n;
        break;
      }

      case "boolean": {
        if (typeof value === "boolean") {
          normalized[field.id] = value;
          break;
        }

        // Optional: accept "true"/"false" strings
        if (typeof value === "string") {
          if (value === "true") normalized[field.id] = true;
          else if (value === "false") normalized[field.id] = false;
          else {
            details.push({
              field: field.id,
              message: `${field.label ?? field.id} must be a boolean`,
            });
          }
          break;
        }

        details.push({
          field: field.id,
          message: `${field.label ?? field.id} must be a boolean`,
        });
        break;
      }

      case "date": {
        if (typeof value !== "string" || !isValidISODateYYYYMMDD(value)) {
          details.push({
            field: field.id,
            message: `${field.label ?? field.id} must be a date in YYYY-MM-DD format`,
          });
          break;
        }
        normalized[field.id] = value;
        break;
      }

      case "select": {
        if (typeof value !== "string") {
          details.push({
            field: field.id,
            message: `${field.label ?? field.id} must be a string`,
          });
          break;
        }
        if (!field.options.includes(value)) {
          details.push({
            field: field.id,
            message: `${field.label ?? field.id} must be one of: ${field.options.join(", ")}`,
          });
          break;
        }
        normalized[field.id] = value;
        break;
      }

      default: {
        // Exhaustiveness (should never hit)
        details.push({
          field: field.id,
          message: `Unsupported field type`,
        });
      }
    }
  }

  if (details.length > 0) {
    return { ok: false, details };
  }

  return { ok: true, data: normalized };
}

export async function GET(req: NextRequest) {
  const collectionId = req.nextUrl.searchParams.get("collectionId");

  if (!collectionId) {
    return NextResponse.json({ error: "collectionId required" }, { status: 400 });
  }

  const records = await prisma.record.findMany({
    where: { collectionId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body.collectionId !== "string" || body.data === undefined) {
    return NextResponse.json(
      { error: 'Invalid request body. "collectionId" and "data" are required.' },
      { status: 400 }
    );
  }

  // Load collection + spec
  const collection = await prisma.collection.findUnique({
    where: { id: body.collectionId },
    include: { template: true },
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const spec = collection.template.spec as TemplateSpecType;

  const validated = validateAndNormalizeRecordData(spec, body.data);

  if (!validated.ok) {
    return NextResponse.json(
      { error: "Validation failed", details: validated.details },
      { status: 400 }
    );
  }

  const record = await prisma.record.create({
    data: {
      collectionId: body.collectionId,
      data: validated.data,
    },
  });

  return NextResponse.json({ record }, { status: 201 });
}