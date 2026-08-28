import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { designs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const userDesigns = await db
    .select({
      id: designs.id,
      title: designs.title,
      status: designs.status,
      isPublic: designs.isPublic,
      updatedAt: designs.updatedAt,
    })
    .from(designs)
    .where(eq(designs.userId, session.user.id!))
    .orderBy(desc(designs.updatedAt))
    .limit(50);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-fg">
            Tony <span className="text-accent">System Design</span>
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Whiteboard luyện system design — kéo thả, test, xuất PNG/Mermaid/SKILL.md
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/editor"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
          >
            + Thiết kế mới
          </Link>
          <SignOutButton />
        </div>
      </header>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Thiết kế của bạn
        </h2>
        {userDesigns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong p-10 text-center">
            <p className="text-fg-muted">Chưa có thiết kế nào.</p>
            <Link
              href="/editor"
              className="mt-3 inline-block text-accent hover:underline"
            >
              Tạo thiết kế đầu tiên →
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {userDesigns.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/editor/${d.id}`}
                  className="block rounded-lg border border-border bg-bg-panel p-4 transition hover:border-accent-dim hover:bg-bg-elev"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-fg">{d.title}</h3>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                        d.status === "published"
                          ? "bg-accent-soft text-accent"
                          : "bg-bg-elev text-fg-muted"
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-fg-muted">
                    Cập nhật {d.updatedAt.toLocaleDateString("vi-VN")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
