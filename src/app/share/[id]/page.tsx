import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicDesign } from "@/lib/designs";
import { BLOCK_CATALOG } from "@/lib/catalog";
import { toMermaid } from "@/lib/export/mermaid";
import { validateCanvasDocument } from "@/lib/canvas-schema";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

/** Public read-only view of a shared design (Issue #7). No login required. */
export default async function SharePage({ params }: Params) {
  const { id } = await params;
  const design = await getPublicDesign(id);
  if (!design) notFound();

  const parsed = validateCanvasDocument(design.canvasData);
  const doc = parsed.ok ? parsed.doc! : { nodes: [], edges: [], meta: { name: design.title } };
  const mermaid = doc.nodes.length > 0 ? toMermaid(doc) : "";

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="border-b border-border pb-6">
        <p className="text-xs uppercase tracking-wide text-fg-muted">
          Thiết kế được chia sẻ · Tony System Design
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-fg">{design.title}</h1>
        {design.description && (
          <p className="mt-2 text-sm text-fg-muted">{design.description}</p>
        )}
        <p className="mt-2 text-xs text-fg-muted">
          {doc.nodes.length} khối · {doc.edges.length} kết nối · Cập nhật{" "}
          {new Date(design.updatedAt).toLocaleDateString("vi-VN")}
        </p>
      </header>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Các khối
        </h2>
        {doc.nodes.length === 0 ? (
          <p className="text-sm text-fg-muted">Thiết kế trống.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {doc.nodes.map((n) => {
              const profile = BLOCK_CATALOG[n.type];
              return (
                <li
                  key={n.id}
                  className="rounded-lg border border-border bg-bg-panel p-4"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: profile?.color ?? "#888" }}
                    />
                    <span className="font-medium text-fg">{n.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">
                    {profile?.label ?? n.type}
                    {typeof n.config?.replicas === "number" &&
                      ` · ${n.config.replicas} replicas`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {mermaid && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg-muted">
            Sơ đồ Mermaid
          </h2>
          <pre className="overflow-x-auto rounded-lg border border-border bg-bg-panel p-4 text-xs leading-relaxed text-fg">
            {mermaid}
          </pre>
          <p className="mt-2 text-xs text-fg-muted">
            Dán vào mermaid.live hoặc GitHub markdown để xem sơ đồ.
          </p>
        </section>
      )}

      <footer className="mt-10 border-t border-border pt-6">
        <Link href="/login" className="text-sm text-accent hover:underline">
          Đăng nhập để tạo thiết kế của bạn →
        </Link>
      </footer>
    </main>
  );
}
