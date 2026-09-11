import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  findDesignById,
  updateDesignOwnedVersioned,
  deleteDesignOwned,
  type DesignUpdate,
} from "@/lib/designs";
import {
  validateCanvasDocument,
  validateTitle,
  validateDescription,
  validateStatus,
  validateIsPublic,
  MAX_BODY_CHARS,
} from "@/lib/canvas-schema";

interface Params {
  params: Promise<{ id: string }>;
}

async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const design = await findDesignById(id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (design.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ design });
}

export async function PUT(req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (rawText.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let body: {
    title?: unknown;
    description?: unknown;
    canvasData?: unknown;
    status?: unknown;
    isPublic?: unknown;
    expectedVersion?: unknown;
  };
  try {
    body = JSON.parse(rawText || "{}");
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: DesignUpdate = {};
  if (body.title !== undefined) {
    const e = validateTitle(body.title);
    if (e) return NextResponse.json({ error: e }, { status: 400 });
    update.title = (body.title as string).trim();
  }
  if (body.description !== undefined) {
    const e = validateDescription(body.description);
    if (e) return NextResponse.json({ error: e }, { status: 400 });
    update.description = (body.description as string | null)?.trim() || null;
  }
  if (body.canvasData !== undefined) {
    const schema = validateCanvasDocument(body.canvasData);
    if (!schema.ok) {
      return NextResponse.json(
        { error: "Invalid canvasData", details: schema.errors.slice(0, 10) },
        { status: 400 },
      );
    }
    update.canvasData = schema.doc;
  }
  if (body.status !== undefined) {
    const e = validateStatus(body.status);
    if (e) return NextResponse.json({ error: e }, { status: 400 });
    update.status = body.status as "draft" | "published";
  }
  if (body.isPublic !== undefined) {
    const e = validateIsPublic(body.isPublic);
    if (e) return NextResponse.json({ error: e }, { status: 400 });
    update.isPublic = body.isPublic as boolean;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Single ownership-scoped + version-checked mutation (Issue #1 + #3 + #8).
  // expectedVersion omitted/undefined = legacy path (no version check).
  const expectedVersion =
    body.expectedVersion === undefined
      ? undefined
      : typeof body.expectedVersion === "number" &&
          Number.isInteger(body.expectedVersion) &&
          body.expectedVersion >= 1
        ? body.expectedVersion
        : -1;
  if (expectedVersion === -1) {
    return NextResponse.json({ error: "Invalid expectedVersion" }, { status: 400 });
  }
  const result = await updateDesignOwnedVersioned(id, userId, update, expectedVersion);
  if (result.status === "stale") {
    return NextResponse.json(
      { error: "Conflict: design was modified elsewhere", currentVersion: result.currentVersion },
      { status: 409 },
    );
  }
  if (result.status === "missing") {
    const existing = await findDesignById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ design: result.design });
}

export async function DELETE(_req: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const deleted = await deleteDesignOwned(id, userId);
  if (!deleted) {
    const existing = await findDesignById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
