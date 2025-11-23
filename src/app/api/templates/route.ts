import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !body.name || !body.spec) {
    return NextResponse.json(
      { error: "Missing name or spec" },
      { status: 400 }
    );
  }

  const template = await prisma.template.create({
    data: {
      name: body.name,
      spec: body.spec,
      version: body.version ?? "1.0.0",
    },
  });

  return NextResponse.json({ template }, { status: 201 });
}
