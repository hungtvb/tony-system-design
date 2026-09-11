import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // Issue #4: throttle registrations per IP before any bcrypt/DB work.
  const ipCheck = await checkRateLimit(
    `register:ip:${getClientIp(req)}`,
    RATE_LIMITS.registerByIp,
  );
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "Thử lại sau ít phút" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(ipCheck.retryAfterMs / 1000)) } },
    );
  }

  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").toLowerCase().trim();
  const password = String(body.password ?? "");
  const name = (body.name ?? "").trim() || null;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Mật khẩu tối thiểu 8 ký tự" },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Email đã được đăng ký" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  // Issue #5: the UNIQUE constraint on users.email is the source of truth.
  // Concurrent registrations for the same email both pass the check above —
  // the loser hits the constraint and must get 409, not 500.
  try {
    const [created] = await db
      .insert(users)
      .values({ email, name, passwordHash })
      .returning({ id: users.id, email: users.email });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "Email đã được đăng ký" },
        { status: 409 },
      );
    }
    throw err;
  }
}

/**
 * Detect a Postgres unique-constraint violation through drizzle/postgres-js.
 * The driver surfaces SQLSTATE 23505 on `code`; match message text as well
 * in case the error is wrapped.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const rec = err as Record<string, unknown>;
  if (rec.code === "23505") return true;
  const msg = `${rec.detail ?? ""} ${rec.message ?? ""} ${rec.cause ?? ""}`;
  return /unique|duplicate/i.test(msg) && /email/i.test(msg);
}
