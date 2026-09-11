import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { designs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  validateCanvasDocument,
  validateTitle,
  validateDescription,
  MAX_BODY_CHARS,
} from "@/lib/canvas-schema";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const userDesigns = await db
    .select({
      id: designs.id,
      title: designs.title,
      description: designs.description,
      status: designs.status,
      isPublic: designs.isPublic,
      createdAt: designs.createdAt,
      updatedAt: designs.updatedAt,
    })
    .from(designs)
    .where(eq(designs.userId, userId))
    .orderBy(desc(designs.updatedAt));

  return NextResponse.json({ designs: userDesigns });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (rawText.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let body: { title?: unknown; description?: unknown; canvasData?: unknown };
  try {
    body = JSON.parse(rawText || "{}");
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const titleErr = validateTitle(body.title);
  if (titleErr) {
    return NextResponse.json({ error: titleErr }, { status: 400 });
  }
  const title = (body.title as string).trim();

  const descErr = validateDescription(body.description);
  if (descErr) {
    return NextResponse.json({ error: descErr }, { status: 400 });
  }

  const canvasData =
    body.canvasData === undefined
      ? { nodes: [], edges: [], meta: { name: title } }
      : body.canvasData;
  const schema = validateCanvasDocument(canvasData);
  if (!schema.ok) {
    return NextResponse.json(
      { error: "Invalid canvasData", details: schema.errors.slice(0, 10) },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(designs)
    .values({
      userId: session.user.id,
      title,
      description: (body.description as string | undefined)?.trim() || null,
      canvasData: schema.doc,
    })
    .returning({
      id: designs.id,
      title: designs.title,
      description: designs.description,
      status: designs.status,
      isPublic: designs.isPublic,
      createdAt: designs.createdAt,
      updatedAt: designs.updatedAt,
    });

  return NextResponse.json({ design: created }, { status: 201 });
}