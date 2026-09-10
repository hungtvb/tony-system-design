"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useCanvasStore } from "@/store/canvasStore";
import Palette from "@/components/canvas/Palette";
import PropertiesPanel from "@/components/canvas/PropertiesPanel";
import { validateDesign } from "@/lib/engine/validation";
import ExportPanel from "@/components/canvas/ExportPanel";
import SimulationPanel from "@/components/canvas/SimulationPanel";
import type Konva from "konva";
import type { CanvasDocument, Severity, ValidationFinding } from "@/lib/types";

const CanvasStage = dynamic(
  () => import("@/components/canvas/CanvasStage"),
  { ssr: false },
);

interface Props {
  designId: string | null;
  initialDoc: CanvasDocument | null;
}

export default function EditorClient({ designId, initialDoc }: Props) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [title, setTitle] = useState(initialDoc?.meta.name ?? "Untitled design");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [savedId, setSavedId] = useState<string | null>(designId);

  const loadDoc = useCanvasStore((s) => s.loadDoc);
  const doc = useCanvasStore((s) => s.doc);
  const revision = useCanvasStore((s) => s.revision);
  const connectingFrom = useCanvasStore((s) => s.connectingFrom);
  const setConnecting = useCanvasStore((s) => s.setConnecting);
  const [showFindings, setShowFindings] = useState(false);
  const [showSim, setShowSim] = useState(false);

  const validation = useMemo(() => {
    if (!showFindings) return null;
    return validateDesign(doc);
  }, [doc, showFindings]);

  // load initial doc once (title already seeded from useState initializer)
  useEffect(() => {
    if (initialDoc) {
      loadDoc(initialDoc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // escape cancels a pending connection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConnecting(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setConnecting]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doSave = useCallback(async () => {
    setSaveState("saving");
    const payload = {
      title,
      canvasData: {
        nodes: doc.nodes,
        edges: doc.edges,
        meta: { ...doc.meta, name: title },
      },
    };
    try {
      let res: Response;
      if (savedId) {
        res = await fetch(`/api/designs/${savedId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/designs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (res.ok) {
        const data = await res.json();
        if (data.design?.id) setSavedId(data.design.id);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } else {
        setSaveState("idle");
      }
    } catch {
      setSaveState("idle");
    }
  }, [doc, title, savedId]);

  useEffect(() => {
    if (revision === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void doSave(), 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  function exportPng() {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = uri;
    a.download = `${title || "design"}.png`;
    a.click();
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-bg-panel px-4 py-2">
        <div className="flex items-center gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-64 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-fg outline-none hover:border-border focus:border-accent-dim"
          />
          <span className="text-xs text-fg-muted">
            {saveState === "saving"
              ? "Đang lưu…"
              : saveState === "saved"
                ? "Đã lưu"
                : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {connectingFrom && (
            <span className="rounded bg-accent-soft px-2 py-1 text-xs text-accent">
              Chọn node đích để nối (Esc huỷ)
            </span>
          )}
          <button
            onClick={() => setShowFindings((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-sm transition hover:border-accent-dim ${
              showFindings
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-fg"
            }`}
          >
            Kiểm tra
            {validation && !validation.ok && (
              <span className="ml-1 rounded bg-danger/20 px-1 text-danger">
                {validation.errorCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowSim((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-sm transition hover:border-accent-dim ${
              showSim
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-fg"
            }`}
          >
            Mô phỏng
          </button>
          <ExportPanel
            title={title}
            getDoc={() => ({ nodes: doc.nodes, edges: doc.edges, meta: { ...doc.meta, name: title } })}
            onExportPng={exportPng}
          />
          <button
            onClick={() => void doSave()}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Lưu
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Palette />
        <div ref={containerRef} className="relative min-w-0 flex-1">
          <CanvasStage
            onStageReady={(stage) => (stageRef.current = stage)}
            width={size.w}
            height={size.h}
          />
          {showFindings && validation && (
            <ValidationPanel
              findings={validation.findings}
              onClose={() => setShowFindings(false)}
              onSelect={(id) => useCanvasStore.getState().selectNode(id)}
            />
          )}
          {showSim && (
            <SimulationPanel
              designId={savedId}
              onClose={() => setShowSim(false)}
            />
          )}
        </div>
        <PropertiesPanel />
      </div>
    </div>
  );
}

const SEVERITY_STYLE: Record<Severity, { dot: string; text: string; label: string }> = {
  error: { dot: "bg-danger", text: "text-danger", label: "Lỗi" },
  warn: { dot: "bg-warn", text: "text-warn", label: "Cảnh báo" },
  info: { dot: "bg-info", text: "text-info", label: "Ghi chú" },
};

function ValidationPanel({
  findings,
  onClose,
  onSelect,
}: {
  findings: ValidationFinding[];
  onClose: () => void;
  onSelect: (nodeId: string) => void;
}) {
  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  const infos = findings.filter((f) => f.severity === "info").length;
  const summary =
    errors === 0 && warns === 0 && infos === 0
      ? "Thiết kế ổn — không có vấn đề."
      : `${errors} lỗi · ${warns} cảnh báo · ${infos} ghi chú`;

  return (
    <div className="absolute bottom-4 right-4 z-10 flex max-h-[60%] w-80 flex-col rounded-lg border border-border bg-bg-panel/95 shadow-xl backdrop-blur">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-sm font-semibold text-fg">Kết quả kiểm tra</div>
        <button
          onClick={onClose}
          className="rounded px-1.5 text-fg-muted transition hover:text-fg"
          aria-label="Đóng"
        >
          ✕
        </button>
      </header>
      <div className="border-b border-border px-3 py-1.5 text-xs text-fg-muted">
        {summary}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {findings.length === 0 ? (
          <div className="px-1 py-3 text-center text-xs text-fg-muted">
            🎉 Không có vấn đề gì.
          </div>
        ) : (
          findings.map((f, i) => {
            const st = SEVERITY_STYLE[f.severity];
            return (
              <button
                key={`${f.ruleId}-${i}`}
                onClick={() => f.nodeIds[0] && onSelect(f.nodeIds[0])}
                className="mb-1.5 block w-full rounded-md border border-border bg-bg-elev px-2.5 py-2 text-left transition hover:border-accent-dim"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                  <span className={`text-xs font-semibold ${st.text}`}>
                    {st.label}
                  </span>
                </div>
                <div className="mt-1 text-xs leading-snug text-fg">
                  {f.message}
                </div>
                {f.hint && (
                  <div className="mt-1 text-[11px] leading-snug text-fg-muted">
                    💡 {f.hint}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
