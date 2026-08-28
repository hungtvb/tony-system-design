import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { designs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

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

  let body: { title: string; description?: string; canvasData?: any };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const canvasData = body.canvasData ?? {
    nodes: [],
    edges: [],
    meta: { name: body.title },
  };

  const [created] = await db
    .insert(designs)
    .values({
      userId: session.user.id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      canvasData,
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