import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (
    !body ||
    typeof body.name !== "string" ||
    typeof body.templateId !== "string"
  ) {
    return NextResponse.json(
      { error: 'Invalid request body. "name" and "templateId" are required.' },
      { status: 400 }
    );
  }

  // Check if template exists
  const templateExists = await prisma.template.findUnique({
    where: { id: body.templateId },
  });

  if (!templateExists) {
    return NextResponse.json({ error: "Template not found." }, { status: 400 });
  }

  const collection = await prisma.collection.create({
    data: {
      name: body.name,
      templateId: body.templateId,
      activeVer: body.activeVer ?? "1.0.0",
      settings: body.settings ?? {},
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
    include: { template: true }, // pulls template.spec
  });

  if (!collection) {
    return NextResponse.json(
      { error: "Collection not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ collection });
}
