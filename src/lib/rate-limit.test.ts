import { describe, it, expect } from "vitest";
import {
  checkRateLimit,
  clearRateLimit,
  getClientIpFromHeaders,
  type RateLimitRule,
} from "./rate-limit";

const SKIP_DB = process.env.SKIP_DB_TESTS === "1";

function headersOf(obj: Record<string, string>) {
  return { get: (name: string) => obj[name.toLowerCase()] ?? null };
}

describe("getClientIpFromHeaders", () => {
  it("prefers x-forwarded-for first entry", () => {
    expect(
      getClientIpFromHeaders(headersOf({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })),
    ).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip, then unknown", () => {
    expect(getClientIpFromHeaders(headersOf({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(getClientIpFromHeaders(headersOf({}))).toBe("unknown");
    expect(getClientIpFromHeaders(undefined)).toBe("unknown");
  });
});

describe.skipIf(SKIP_DB)("checkRateLimit (Issue #4)", () => {
  const rule: RateLimitRule = { limit: 3, windowMs: 60_000 };

  it("allows up to the limit, then blocks with retryAfterMs", async () => {
    const key = `test-limit-${Date.now()}-a`;
    await clearRateLimit(key);
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit(key, rule);
      expect(r.allowed).toBe(true);
      expect(r.retryAfterMs).toBe(0);
    }
    const blocked = await checkRateLimit(key, rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    await clearRateLimit(key);
  });

  it("windows are independent per key", async () => {
    const k1 = `test-limit-${Date.now()}-b1`;
    const k2 = `test-limit-${Date.now()}-b2`;
    await clearRateLimit(k1);
    await clearRateLimit(k2);
    for (let i = 0; i < 3; i++) await checkRateLimit(k1, rule);
    expect((await checkRateLimit(k1, rule)).allowed).toBe(false);
    expect((await checkRateLimit(k2, rule)).allowed).toBe(true);
    await clearRateLimit(k1);
    await clearRateLimit(k2);
  });

  it("clearRateLimit resets the window", async () => {
    const key = `test-limit-${Date.now()}-c`;
    const tiny: RateLimitRule = { limit: 1, windowMs: 60_000 };
    await clearRateLimit(key);
    expect((await checkRateLimit(key, tiny)).allowed).toBe(true);
    expect((await checkRateLimit(key, tiny)).allowed).toBe(false);
    await clearRateLimit(key);
    expect((await checkRateLimit(key, tiny)).allowed).toBe(true);
    await clearRateLimit(key);
  });
});
