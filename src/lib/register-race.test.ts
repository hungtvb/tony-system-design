import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isUniqueViolation } from "@/app/api/auth/register/route";

const SKIP_DB = process.env.SKIP_DB_TESTS === "1";

/**
 * Regression test for Issue #5: concurrent registrations for the same email
 * must yield exactly one account; the loser hits the UNIQUE constraint and
 * maps to 409 (via isUniqueViolation), never 500.
 */
describe.skipIf(SKIP_DB)("concurrent registration (Issue #5)", () => {
  const emails: string[] = [];

  afterAll(async () => {
    for (const email of emails) {
      await db.delete(users).where(eq(users.email, email));
    }
  });

  it("two simultaneous inserts for the same email: one wins, one violates", async () => {
    const email = `race-${Date.now()}@test.local`;
    emails.push(email);

    const attempt = () =>
      db
        .insert(users)
        .values({ email, name: "Racer", passwordHash: "x".repeat(60) })
        .returning({ id: users.id });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(isUniqueViolation(reason)).toBe(true);

    // exactly one account exists
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(1);
  });

  it("isUniqueViolation detects code 23505 and wrapped messages", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation(new Error('duplicate key value violates unique constraint "users_email_unique" email'))).toBe(true);
    expect(isUniqueViolation(new Error("connection reset"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});
