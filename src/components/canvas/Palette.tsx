"use client";

import { BLOCK_ORDER, BLOCK_CATALOG } from "@/lib/catalog";
import { useCanvasStore } from "@/store/canvasStore";
import type { BlockTypeId } from "@/lib/types";

export default function Palette() {
  const addNode = useCanvasStore((s) => s.addNode);
  const nodeCount = useCanvasStore((s) => s.doc.nodes.length);

  function add(type: BlockTypeId) {
    // Place new nodes in a deterministic grid so render remains pure.
    const column = nodeCount % 3;
    const row = Math.floor(nodeCount / 3);
    addNode(type, 80 + column * 120, 80 + row * 100);
  }

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-bg-panel">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Khối hạ tầng
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-1 gap-2">
          {BLOCK_ORDER.map((type) => {
            const p = BLOCK_CATALOG[type];
            return (
              <button
                key={type}
                onClick={() => add(type)}
                className="group flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-left text-sm transition hover:border-accent-dim"
              >
                <span
                  className="h-3 w-3 flex-shrink-0 rounded-sm"
                  style={{ background: p.color }}
                />
                <span className="text-fg">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-border px-4 py-3 text-[11px] text-fg-muted">
        Click để thêm node vào canvas.
      </div>
    </aside>
  );
}
