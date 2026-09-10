"use client";

import { useEffect, useRef, useState } from "react";
import type { CanvasDocument } from "@/lib/types";
import { toMermaid } from "@/lib/export/mermaid";
import { toSkillMd } from "@/lib/export/skillmd";

type Format = "mermaid" | "skillmd";

interface Props {
  title: string;
  getDoc: () => CanvasDocument;
  onExportPng: () => void;
}

function buildText(format: Format, doc: CanvasDocument): { text: string; filename: string; mime: string } {
  if (format === "mermaid") {
    return { text: toMermaid(doc), filename: `${doc.meta.name || "design"}.mmd`, mime: "text/plain" };
  }
  return { text: toSkillMd(doc), filename: `${doc.meta.name || "design"}.SKILL.md`, mime: "text/markdown" };
}

function downloadText(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPanel({ title, getDoc, onExportPng }: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Format | null>(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setPreview(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const doc = getDoc();
  const previewData = preview ? buildText(preview, { ...doc, meta: { ...doc.meta, name: title } }) : null;

  async function copyPreview() {
    if (!previewData) return;
    try {
      await navigator.clipboard.writeText(previewData.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable — user can still download
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`rounded-md border px-3 py-1.5 text-sm transition hover:border-accent-dim ${
          open ? "border-accent bg-accent-soft text-accent" : "border-border text-fg"
        }`}
      >
        Xuất ▾
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-border bg-bg-panel shadow-xl">
          <button
            onClick={() => {
              setOpen(false);
              onExportPng();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-fg transition hover:bg-bg-elev"
          >
            Ảnh PNG
          </button>
          <button
            onClick={() => {
              setOpen(false);
              setPreview("mermaid");
            }}
            className="block w-full px-3 py-2 text-left text-sm text-fg transition hover:bg-bg-elev"
          >
            Mermaid <span className="text-fg-muted">(.mmd)</span>
          </button>
          <button
            onClick={() => {
              setOpen(false);
              setPreview("skillmd");
            }}
            className="block w-full px-3 py-2 text-left text-sm text-fg transition hover:bg-bg-elev"
          >
            SKILL.md
          </button>
        </div>
      )}

      {previewData && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-bg-panel shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="text-sm font-semibold text-fg">
                {preview === "mermaid" ? "Mermaid — dán vào mermaid.live / GitHub" : "SKILL.md — mô tả kiến trúc cho AI agent"}
              </div>
              <button
                onClick={() => setPreview(null)}
                className="rounded px-1.5 text-fg-muted transition hover:text-fg"
                aria-label="Đóng"
              >
                ✕
              </button>
            </header>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-relaxed text-fg">
              {previewData.text}
            </pre>
            <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
              <button
                onClick={() => void copyPreview()}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-fg transition hover:border-accent-dim"
              >
                {copied ? "Đã chép ✓" : "Chép"}
              </button>
              <button
                onClick={() => {
                  if (previewData) downloadText(previewData.text, previewData.filename, previewData.mime);
                }}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-black transition hover:brightness-110"
              >
                Tải xuống
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
