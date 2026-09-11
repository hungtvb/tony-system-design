import { db } from "@/db";
import { authAttempts } from "@/db/schema";
import { and, eq, gt, lt, sql } from "drizzle-orm";

/**
 * DB-backed sliding-window rate limiter (Issue #4).
 * Limits hold across multiple app instances because state lives in Postgres.
 *
 * Documented auth limits (see RATE_LIMITS):
 * - register: 10 req / 10 min per IP
 * - login: 20 req / 10 min per IP, 10 req / 10 min per email
 *
 * Failed logins still run bcrypt inside authorize(), so the email+IP
 * throttle is what makes brute force expensive: 10 tries / 10 min per
 * account ≈ 1440 guesses/day, useless against bcrypt-hashed passwords.
 * Errors always return null (no user-enumeration oracle).
 */

export interface RateLimitRule {
  /** max attempts allowed inside windowMs */
  limit: number;
  /** sliding window in milliseconds */
  windowMs: number;
}

export const RATE_LIMITS = {
  registerByIp: { limit: 10, windowMs: 10 * 60_000 },
  loginByIp: { limit: 20, windowMs: 10 * 60_000 },
  loginByEmail: { limit: 10, windowMs: 10 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

const MAX_WINDOW_MS = Math.max(...Object.values(RATE_LIMITS).map((r) => r.windowMs));

export function getClientIpFromHeaders(
  headers: { get(name: string): string | null } | undefined,
): string {
  const fwd = headers?.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 100);
  const real = headers?.get("x-real-ip");
  if (real) return real.trim().slice(0, 100);
  return "unknown";
}

export function getClientIp(req: Request): string {
  return getClientIpFromHeaders(req.headers);
}

export interface RateCheck {
  allowed: boolean;
  /** ms until the oldest attempt in the window expires (0 when allowed) */
  retryAfterMs: number;
}

/**
 * Record an attempt for `key` and report whether the sliding window is over
 * the rule's limit. Prunes attempts older than the largest window first.
 */
export async function checkRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<RateCheck> {
  const now = new Date();
  // Best-effort prune of rows no rule can still see.
  await db
    .delete(authAttempts)
    .where(lt(authAttempts.createdAt, new Date(now.getTime() - MAX_WINDOW_MS)));

  const windowStart = new Date(now.getTime() - rule.windowMs);
  const rows = await db
    .select({ createdAt: authAttempts.createdAt })
    .from(authAttempts)
    .where(and(eq(authAttempts.key, key), gt(authAttempts.createdAt, windowStart)))
    .orderBy(authAttempts.createdAt);

  if (rows.length >= rule.limit) {
    const oldest = rows[0]!.createdAt.getTime();
    return { allowed: false, retryAfterMs: Math.max(0, oldest + rule.windowMs - now.getTime()) };
  }

  await db.insert(authAttempts).values({ key });
  return { allowed: true, retryAfterMs: 0 };
}

/** Remove all recorded attempts — used by tests to reset state. */
export async function clearRateLimit(key?: string): Promise<void> {
  if (key) {
    await db.delete(authAttempts).where(eq(authAttempts.key, key));
  } else {
    await db.delete(authAttempts).where(sql`1 = 1`);
  }
}
