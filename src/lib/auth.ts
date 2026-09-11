import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit, getClientIpFromHeaders, RATE_LIMITS } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        // Issue #4: throttle by account + IP before bcrypt. The IP is read
        // from proxy headers when present; authorize() receives the raw
        // Request as 2nd arg in Auth.js v5.
        const ip = getClientIpFromHeaders(req?.headers as unknown as { get(name: string): string | null } | undefined);
        const [byEmail, byIp] = await Promise.all([
          checkRateLimit(`login:email:${email.slice(0, 120)}`, RATE_LIMITS.loginByEmail),
          checkRateLimit(`login:ip:${ip}`, RATE_LIMITS.loginByIp),
        ]);
        // Same null return whether throttled or bad credentials: no
        // user-enumeration oracle, no hint that throttling kicked in.
        if (!byEmail.allowed || !byIp.allowed) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
