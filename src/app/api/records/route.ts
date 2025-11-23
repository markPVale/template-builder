import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const collectionId = req.nextUrl.searchParams.get("collectionId");

  if (!collectionId) {
    return NextResponse.json(
      { error: "collectionId required" },
      { status: 400 }
    );
  }

  const records = await prisma.record.findMany({
    where: { collectionId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !body.collectionId || !body.data) {
    return NextResponse.json(
      { error: "collectionId and data required" },
      { status: 400 }
    );
  }

  // TODO: validate data against TemplateSpec
  const record = await prisma.record.create({
    data: {
      collectionId: body.collectionId,
      data: body.data,
    },
  });

  return NextResponse.json({ record }, { status: 201 });
}
