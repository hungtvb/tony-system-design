import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import { designs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  updateDesignOwned,
  updateDesignOwnedVersioned,
  deleteDesignOwned,
  findDesignById,
  getPublicDesign,
} from "./designs";

/**
 * Integration tests for ownership-scoped mutations (Issue #1, #8).
 * Uses the real Postgres from DATABASE_URL. Rows are cleaned up after.
 *
 * Set SKIP_DB_TESTS=1 to skip when Postgres is unreachable (e.g. sandbox
 * without a local DB). CI / dev boxes with Postgres run the full suite.
 */
const SKIP_DB = process.env.SKIP_DB_TESTS === "1";

describe.skipIf(SKIP_DB)("ownership-scoped design mutations", () => {
  let userA = "";
  let userB = "";
  let designId = "";
  const createdDesignIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const [a] = await db
      .insert(users)
      .values({ email: `owner-a-${Date.now()}@test.local`, name: "Owner A" })
      .returning({ id: users.id });
    const [b] = await db
      .insert(users)
      .values({ email: `owner-b-${Date.now()}@test.local`, name: "Owner B" })
      .returning({ id: users.id });
    userA = a.id;
    userB = b.id;
    createdUserIds.push(userA, userB);

    const [d] = await db
      .insert(designs)
      .values({
        userId: userA,
        title: "A's design",
        canvasData: { nodes: [], edges: [], meta: { name: "A's design" } },
      })
      .returning({ id: designs.id });
    designId = d.id;
    createdDesignIds.push(designId);
  });

  afterAll(async () => {
    for (const id of createdDesignIds) {
      await db.delete(designs).where(eq(designs.id, id));
    }
    // users cascade-delete their designs; delete test users last
    for (const id of createdUserIds) {
      await db.delete(users).where(eq(users.id, id));
    }
  });

  it("user B cannot PUT user A's design (returns null)", async () => {
    const res = await updateDesignOwned(designId, userB, { title: "Hacked" });
    expect(res).toBeNull();
    // title unchanged
    const d = await findDesignById(designId);
    expect(d?.title).toBe("A's design");
  });

  it("user B cannot DELETE user A's design (returns null)", async () => {
    const res = await deleteDesignOwned(designId, userB);
    expect(res).toBeNull();
    const d = await findDesignById(designId);
    expect(d).not.toBeNull();
  });

  it("owner CAN update own design (returns row, bumps updatedAt)", async () => {
    const before = await findDesignById(designId);
    // ensure clock moves so updatedAt bump is observable
    await new Promise((r) => setTimeout(r, 1100));
    const res = await updateDesignOwned(designId, userA, { title: "A edited" });
    expect(res).not.toBeNull();
    expect(res?.title).toBe("A edited");
    expect(new Date(res!.updatedAt).getTime()).toBeGreaterThan(
      new Date(before!.updatedAt).getTime(),
    );
    createdDesignIds.push(designId);
  });

  it("update on missing id returns null (no 200-with-undefined)", async () => {
    const res = await updateDesignOwned(
      "00000000-0000-0000-0000-000000000000",
      userA,
      { title: "ghost" },
    );
    expect(res).toBeNull();
  });

  it("owner CAN delete own design (returns id)", async () => {
    const [d] = await db
      .insert(designs)
      .values({
        userId: userA,
        title: "temp",
        canvasData: { nodes: [], edges: [], meta: { name: "temp" } },
      })
      .returning({ id: designs.id });
    const res = await deleteDesignOwned(d.id, userA);
    expect(res?.id).toBe(d.id);
    expect(await findDesignById(d.id)).toBeNull();
  });

  it("stale versioned write is rejected, newer state survives (Issue #3)", async () => {
    const [d] = await db
      .insert(designs)
      .values({
        userId: userA,
        title: "race",
        canvasData: { nodes: [], edges: [], meta: { name: "race" } },
      })
      .returning({ id: designs.id });
    createdDesignIds.push(d.id);
    const v1 = (await findDesignById(d.id))!.version;

    // Writer B (fresh version) wins first
    const win = await updateDesignOwnedVersioned(d.id, userA, { title: "B wins" }, v1);
    expect(win.status).toBe("ok");

    // Writer A (stale version v1) must NOT overwrite B
    const stale = await updateDesignOwnedVersioned(d.id, userA, { title: "A stale" }, v1);
    expect(stale.status).toBe("stale");
    if (stale.status === "stale") {
      expect(stale.currentVersion).toBe(v1 + 1);
    }
    expect((await findDesignById(d.id))?.title).toBe("B wins");

    // Retry with the fresh version succeeds and bumps again
    const retry = await updateDesignOwnedVersioned(
      d.id, userA, { title: "A retry" }, v1 + 1,
    );
    expect(retry.status).toBe("ok");
    if (retry.status === "ok") {
      expect(retry.design.version).toBe(v1 + 2);
    }
  });

  it("versioned write without expectedVersion falls back to plain update", async () => {
    const res = await updateDesignOwnedVersioned(
      designId, userA, { title: "no-version-check" }, undefined,
    );
    expect(res.status).toBe("ok");
  });

  it("public contract (Issue #7): only isPublic=true rows readable, no userId leaked", async () => {
    // private design (default isPublic=false) → null
    const priv = await getPublicDesign(designId);
    expect(priv).toBeNull();

    // flip to public → readable, limited projection
    await updateDesignOwned(designId, userA, { isPublic: true });
    const pub = await getPublicDesign(designId);
    expect(pub).not.toBeNull();
    expect(pub?.id).toBe(designId);
    expect(pub).not.toHaveProperty("userId");
    expect(pub).not.toHaveProperty("isPublic");

    // flip back → null again
    await updateDesignOwned(designId, userA, { isPublic: false });
    expect(await getPublicDesign(designId)).toBeNull();

    // missing id → null (same as private: no existence oracle)
    expect(await getPublicDesign("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
