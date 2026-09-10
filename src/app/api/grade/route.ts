import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { designs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { gradeDesign, listProblems } from "@/lib/engine/quiz";
import type { CanvasDocument } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ problems: listProblems() });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { designId?: string; problemSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.designId || !body.problemSlug) {
    return NextResponse.json(
      { error: "designId and problemSlug required" },
      { status: 400 },
    );
  }

  const [design] = await db
    .select({ canvasData: designs.canvasData })
    .from(designs)
    .where(
      and(eq(designs.id, body.designId), eq(designs.userId, session.user.id)),
    )
    .limit(1);

  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  const doc = design.canvasData as unknown as CanvasDocument;
  const result = gradeDesign(doc, body.problemSlug);
  return NextResponse.json(result);
}
