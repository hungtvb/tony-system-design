import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { designs } from "@/db/schema";
import { eq } from "drizzle-orm";

interface Params {
  params: Promise<{ id: string }>;
}

async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

async function findDesign(id: string) {
  const [d] = await db
    .select()
    .from(designs)
    .where(eq(designs.id, id))
    .limit(1);
  return d ?? null;
}

export async function GET(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const design = await findDesign(id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (design.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ design });
}

export async function PUT(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const design = await findDesign(id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (design.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    title?: string;
    description?: string | null;
    canvasData?: any;
    status?: "draft" | "published";
    isPublic?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, any> = {};
  if (body.title !== undefined) update.title = body.title.trim();
  if (body.description !== undefined) update.description = body.description?.trim() || null;
  if (body.canvasData !== undefined) update.canvasData = body.canvasData;
  if (body.status !== undefined) update.status = body.status;
  if (body.isPublic !== undefined) update.isPublic = body.isPublic;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(designs)
    .set(update)
    .where(eq(designs.id, id))
    .returning({
      id: designs.id,
      title: designs.title,
      description: designs.description,
      status: designs.status,
      isPublic: designs.isPublic,
      createdAt: designs.createdAt,
      updatedAt: designs.updatedAt,
    });

  return NextResponse.json({ design: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const design = await findDesign(id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (design.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(designs).where(eq(designs.id, id));
  return NextResponse.json({ ok: true });
}