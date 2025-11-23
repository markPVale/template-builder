import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.prompt !== "string") {
    return NextResponse.json(
      { error: 'Invalid request body. "message" is required.' },
      { status: 400 }
    );
  }

  // TODO: call LLM here and return a TemplateSpec
  // For now, just echo
  return NextResponse.json({
    message: "Assistant stub",
    prompt: body.prompt,
  });
}
