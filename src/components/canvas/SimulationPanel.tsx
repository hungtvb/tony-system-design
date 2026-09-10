"use client";

import { useState } from "react";
import { useCanvasStore } from "@/store/canvasStore";
import type { SimulationResult } from "@/lib/types";

interface Props {
  designId: string | null;
  onClose: () => void;
}

function fmt(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString("vi-VN");
  return n.toFixed(digits);
}

export default function SimulationPanel({ designId, onClose }: Props) {
  const doc = useCanvasStore((s) => s.doc);
  const [inputRps, setInputRps] = useState(1000);
  const [failureNodeId, setFailureNodeId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!designId) {
      setError("Hãy lưu thiết kế trước khi mô phỏng.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designId,
          inputRps,
          failureNodeId: failureNodeId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Lỗi ${res.status}`);
        return;
      }
      setResult((await res.json()) as SimulationResult);
    } catch {
      setError("Không kết nối được tới server.");
    } finally {
      setLoading(false);
    }
  }

  const bottleneckLabel = result?.bottleneckNodeId
    ? result.nodeStats.find((s) => s.nodeId === result.bottleneckNodeId)?.label ??
      result.bottleneckNodeId
    : null;

  return (
    <div className="absolute bottom-4 left-4 z-10 flex max-h-[70%] w-96 flex-col rounded-lg border border-border bg-bg-panel/95 shadow-xl backdrop-blur">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-sm font-semibold text-fg">Mô phỏng tải</div>
        <button
          onClick={onClose}
          className="rounded px-1.5 text-fg-muted transition hover:text-fg"
          aria-label="Đóng"
        >
          ✕
        </button>
      </header>

      <div className="border-b border-border px-3 py-2">
        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-xs text-fg-muted">
              Tải đầu vào (req/s)
            </span>
            <input
              type="number"
              min={1}
              max={10_000_000}
              value={inputRps}
              onChange={(e) => setInputRps(Number(e.target.value) || 0)}
              className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg outline-none focus:border-accent-dim"
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs text-fg-muted">
              Giả lập chết node
            </span>
            <select
              value={failureNodeId}
              onChange={(e) => setFailureNodeId(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg outline-none focus:border-accent-dim"
            >
              <option value="">Không</option>
              {doc.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => void run()}
            disabled={loading}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "…" : "Chạy"}
          </button>
        </div>
        {!designId && (
          <p className="mt-1.5 text-xs text-warn">
            Chưa lưu — hãy bấm “Lưu” trước rồi chạy mô phỏng.
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {error && (
          <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        {!result && !error && (
          <p className="py-3 text-center text-xs text-fg-muted">
            Nhập tải rồi bấm “Chạy” để mô phỏng.
          </p>
        )}
        {result && (
          <div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-border bg-bg-elev px-2 py-2">
                <div className="text-base font-bold text-accent">
                  {fmt(result.throughput, 0)}
                </div>
                <div className="text-[11px] text-fg-muted">req/s thành công</div>
              </div>
              <div className="rounded-md border border-border bg-bg-elev px-2 py-2">
                <div className="text-base font-bold text-fg">
                  {fmt(result.p95Ms)}<span className="text-xs">ms</span>
                </div>
                <div className="text-[11px] text-fg-muted">p95 latency</div>
              </div>
              <div className="rounded-md border border-border bg-bg-elev px-2 py-2">
                <div
                  className={`text-base font-bold ${
                    result.errorRate > 0.01 ? "text-danger" : "text-fg"
                  }`}
                >
                  {(result.errorRate * 100).toFixed(1)}%
                </div>
                <div className="text-[11px] text-fg-muted">tỉ lệ rớt</div>
              </div>
            </div>

            <div className="mt-2 text-xs text-fg-muted">
              p50 {fmt(result.p50Ms)}ms · p99 {fmt(result.p99Ms)}ms
              {bottleneckLabel && (
                <>
                  {" "}· nghẽn tại <span className="text-warn">{bottleneckLabel}</span>
                </>
              )}
              {result.failureInjected && (
                <div className="mt-1">
                  Giả lập chết node:{" "}
                  <span className={result.survivedFailure ? "text-accent" : "text-danger"}>
                    {result.survivedFailure ? "hệ thống sống sót ✓" : "hệ thống sập ✗"}
                  </span>
                </div>
              )}
            </div>

            <ul className="mt-2 space-y-1.5">
              {result.nodeStats.map((s) => (
                <li
                  key={s.nodeId}
                  className={`rounded-md border px-2.5 py-1.5 ${
                    s.overloaded
                      ? "border-danger/50 bg-danger/5"
                      : "border-border bg-bg-elev"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-fg">{s.label}</span>
                    <span className={s.overloaded ? "text-danger" : "text-fg-muted"}>
                      {(s.utilization * 100).toFixed(0)}%
                      {s.overloaded ? " quá tải" : ""}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg">
                    <div
                      className={`h-full rounded-full ${
                        s.overloaded ? "bg-danger" : "bg-accent"
                      }`}
                      style={{ width: `${Math.min(100, s.utilization * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-fg-muted">
                    {fmt(s.avgLatencyMs)}ms
                    {s.dropped > 0 && ` · rớt ${fmt(s.dropped, 0)} req/s`}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
