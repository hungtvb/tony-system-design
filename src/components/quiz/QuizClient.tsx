"use client";

import { useState } from "react";
import type { QuizResult } from "@/lib/types";

interface Problem {
  slug: string;
  title: string;
  description: string;
}

interface Design {
  id: string;
  title: string;
}

export default function QuizClient({
  problems,
  designs,
}: {
  problems: Problem[];
  designs: Design[];
}) {
  const [problemSlug, setProblemSlug] = useState(problems[0]?.slug ?? "");
  const [designId, setDesignId] = useState(designs[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function grade() {
    if (!designId || !problemSlug) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId, problemSlug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Lỗi ${res.status}`);
        return;
      }
      const data = (await res.json()) as QuizResult;
      setResult(data);
    } catch {
      setError("Không kết nối được tới server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-border bg-bg-panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          1. Chọn bài tập
        </h2>
        <div className="mt-3 space-y-2">
          {problems.map((p) => (
            <button
              key={p.slug}
              onClick={() => setProblemSlug(p.slug)}
              className={`block w-full rounded-md border p-3 text-left transition ${
                problemSlug === p.slug
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-bg-elev hover:border-accent-dim"
              }`}
            >
              <div className="text-sm font-semibold text-fg">{p.title}</div>
              <div className="mt-0.5 text-xs text-fg-muted">{p.description}</div>
            </button>
          ))}
        </div>

        <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-fg-muted">
          2. Chọn thiết kế
        </h2>
        {designs.length === 0 ? (
          <p className="mt-3 text-sm text-fg-muted">
            Chưa có thiết kế nào — hãy tạo ở trang Editor trước.
          </p>
        ) : (
          <select
            value={designId}
            onChange={(e) => setDesignId(e.target.value)}
            className="mt-3 w-full rounded-md border border-border bg-bg-elev px-3 py-2 text-sm text-fg outline-none focus:border-accent-dim"
          >
            {designs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => void grade()}
          disabled={loading || !designId || !problemSlug}
          className="mt-5 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Đang chấm…" : "Chấm điểm"}
        </button>
      </section>

      <section className="rounded-lg border border-border bg-bg-panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          3. Kết quả
        </h2>
        {error && (
          <div className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        {!result && !error && (
          <p className="mt-3 text-sm text-fg-muted">
            Chưa chấm — chọn bài + thiết kế rồi bấm &quot;Chấm điểm&quot;.
          </p>
        )}
        {result && (
          <div className="mt-3">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-lg px-4 py-2 text-2xl font-bold ${
                  result.passed
                    ? "bg-accent-soft text-accent"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {result.score}
              </div>
              <div className="text-sm">
                <div className="font-semibold text-fg">
                  {result.passed ? "Đạt 🎉" : "Chưa đạt"}
                </div>
                <div className="text-fg-muted">{result.problemSlug}</div>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {result.checks.map((c, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border bg-bg-elev px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span>{c.passed ? "✅" : "❌"}</span>
                    <span className="font-medium text-fg">{c.label}</span>
                  </div>
                  <div className="mt-1 text-xs text-fg-muted">{c.detail}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
