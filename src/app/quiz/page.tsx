import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { designs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { SignOutButton } from "@/components/SignOutButton";
import { listProblems } from "@/lib/engine/quiz";
import QuizClient from "@/components/quiz/QuizClient";

export const dynamic = "force-dynamic";

export default async function QuizPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const userDesigns = await db
    .select({ id: designs.id, title: designs.title })
    .from(designs)
    .where(eq(designs.userId, session.user.id!))
    .orderBy(desc(designs.updatedAt))
    .limit(50);

  const problems = listProblems();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-fg">
            Luyện <span className="text-accent">System Design</span>
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Chọn bài tập + thiết kế của bạn, máy sẽ chấm theo checklist.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-md border border-border px-4 py-2 text-sm text-fg transition hover:border-accent-dim"
          >
            ← Trang chủ
          </Link>
          <SignOutButton />
        </div>
      </header>

      <QuizClient problems={problems} designs={userDesigns} />
    </main>
  );
}
