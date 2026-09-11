import { db } from "@/db";
import { designs } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const designReturnColumns = {
  id: designs.id,
  title: designs.title,
  description: designs.description,
  status: designs.status,
  isPublic: designs.isPublic,
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
    .returning(designReturnColumns);
  return updated ?? null;
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
