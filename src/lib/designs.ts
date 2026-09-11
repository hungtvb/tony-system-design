import { db } from "@/db";
import { designs } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const designReturnColumns = {
  id: designs.id,
  title: designs.title,
  description: designs.description,
  status: designs.status,
  isPublic: designs.isPublic,
  version: designs.version,
  createdAt: designs.createdAt,
  updatedAt: designs.updatedAt,
};

export type DesignUpdate = Partial<{
  title: string;
  description: string | null;
  canvasData: unknown;
  status: "draft" | "published";
  isPublic: boolean;
}>;

export async function findDesignById(id: string) {
  const [d] = await db.select().from(designs).where(eq(designs.id, id)).limit(1);
  return d ?? null;
}

/**
 * Ownership-scoped update in a SINGLE DB operation (Issue #1).
 * Returns the updated row, or null when id doesn't exist OR belongs to
 * someone else. Caller distinguishes 404 vs 403 via findDesignById().
 */
export async function updateDesignOwned(
  id: string,
  userId: string,
  update: DesignUpdate,
) {
  const [updated] = await db
    .update(designs)
    .set({ ...update, updatedAt: new Date() })
    .where(and(eq(designs.id, id), eq(designs.userId, userId)))
    .returning();
  return updated ?? null;
}

export type UpdateOwnedResult =
  | { status: "ok"; design: typeof designs.$inferSelect }
  | { status: "stale"; currentVersion: number | null }
  | { status: "missing" };

/**
 * Ownership-scoped + optimistic-concurrency update (Issue #3).
 * Single UPDATE with WHERE(id AND userId AND version=expected), bumping
 * version atomically via SQL. Concurrent stale writers get "stale"
 * instead of silently overwriting newer state.
 */
export async function updateDesignOwnedVersioned(
  id: string,
  userId: string,
  update: DesignUpdate,
  expectedVersion: number | undefined,
): Promise<UpdateOwnedResult> {
  if (expectedVersion === undefined) {
    const updated = await updateDesignOwned(id, userId, update);
    return updated ? { status: "ok", design: updated } : { status: "missing" };
  }
  const [updated] = await db
    .update(designs)
    .set({
      ...update,
      version: sql`${designs.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(designs.id, id),
        eq(designs.userId, userId),
        eq(designs.version, expectedVersion),
      ),
    )
    .returning();
  if (updated) return { status: "ok", design: updated };
  // null = either missing/forbidden OR stale version — distinguish:
  const existing = await findDesignById(id);
  if (!existing || existing.userId !== userId) return { status: "missing" };
  return { status: "stale", currentVersion: existing.version };
}

/**
 * Ownership-scoped delete in a SINGLE DB operation (Issue #1).
 * Returns the deleted id, or null when id doesn't exist OR belongs to
 * someone else.
 */
export async function deleteDesignOwned(id: string, userId: string) {
  const [deleted] = await db
    .delete(designs)
    .where(and(eq(designs.id, id), eq(designs.userId, userId)))
    .returning({ id: designs.id });
  return deleted ?? null;
}
