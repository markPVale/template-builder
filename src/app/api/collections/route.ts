import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { JsonValue } from "@prisma/client/runtime/library";

type SpecView = { id?: unknown; default?: unknown };
type Spec = { views?: unknown };

const get_default_view_id = (spec: Spec): string | null => {
  const views = spec?.views;
  if (!Array.isArray(views) || views.length === 0) return null;

  const explicitDefault = views.find((v) => {
    const view = v as SpecView;
    return view?.default === true;
  }) as SpecView | undefined;

  const defaultId = explicitDefault?.id;
  if (typeof defaultId === "string" && defaultId.length > 0) return defaultId;

  const firstId = (views[0] as SpecView | undefined)?.id;
  if (typeof firstId === "string" && firstId.length > 0) return firstId;

  return null;
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body.name !== "string" || typeof body.templateId !== "string") {
    return NextResponse.json(
      { error: 'Invalid request body. "name" and "templateId" are required.' },
      { status: 400 }
    );
  }

  const name = body.name.trim();
  if (name.length === 0) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  // Load template (exists + get version/spec)
  const template = await prisma.template.findUnique({
    where: { id: body.templateId },
    select: { id: true, version: true, spec: true },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const defaultViewId = get_default_view_id(template.spec as Spec);

  const settings: JsonValue| undefined = defaultViewId
    ? ({ activeView: defaultViewId } satisfies JsonValue)
    : undefined;

  const collection = await prisma.collection.create({
    data: {
      name,
      templateId: template.id,
      activeVer: template.version, // ✅ source of truth
      settings,
    },
  });

  return NextResponse.json({ collection }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: 'Query param "id" is required.' },
      { status: 400 }
    );
  }

  const collection = await prisma.collection.findUnique({
    where: { id },
    include: { template: true },
  });

  if (!collection) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  return NextResponse.json({ collection });
}

// PATCH /api/collections
// body: { id: string, activeView: string }
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body.id !== "string" || typeof body.activeView !== "string") {
    return NextResponse.json({ error: "id and activeView required" }, { status: 400 });
  }

  const activeView = body.activeView.trim();
  if (activeView.length === 0) {
    return NextResponse.json({ error: "activeView required" }, { status: 400 });
  }

  // Load collection + template spec to validate view id
  const existing = await prisma.collection.findUnique({
    where: { id: body.id },
    include: { template: { select: { spec: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  }

  const spec = existing.template?.spec as Spec | undefined;
  const views = spec?.views;

  const isValidView =
    Array.isArray(views) &&
    views.some((v) => {
      const view = v as SpecView;
      return typeof view?.id === "string" && view.id === activeView;
    });

  if (!isValidView) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: [
          {
            field: "activeView",
            message: `Unknown view "${activeView}" for this template`,
          },
        ],
      },
      { status: 400 }
    );
  }

  const prior = (existing.settings as Record<string, unknown> | null) ?? {};

  const next = {
    ...prior,
    activeView,
  };

  const updated = await prisma.collection.update({
    where: { id: body.id },
    data: { settings: next },
  });

  return NextResponse.json({ collection: updated }, { status: 200 });
}