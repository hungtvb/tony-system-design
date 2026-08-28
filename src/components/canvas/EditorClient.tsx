"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useCanvasStore } from "@/store/canvasStore";
import Palette from "@/components/canvas/Palette";
import PropertiesPanel from "@/components/canvas/PropertiesPanel";
import CanvasStage from "@/components/canvas/CanvasStage";
import Konva from "konva";

interface Props {
  designId: string | null;
  initialDoc: {
    nodes: any[];
    edges: any[];
    meta: { name: string };
  } | null;
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

  useEffect(() => {
    if (initialDoc) {
      loadDoc(initialDoc as any);
      setTitle(initialDoc.meta.name);
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
  useEffect(() => {
    if (revision === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void doSave(), 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

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
            onClick={exportPng}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-fg transition hover:border-accent-dim"
          >
            Export PNG
          </button>
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
          <CanvasStage ref={stageRef} width={size.w} height={size.h} />
        </div>
        <PropertiesPanel />
      </div>
    </div>
  );
}
