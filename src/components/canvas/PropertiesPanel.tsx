"use client";

import { useCanvasStore } from "@/store/canvasStore";
import { BLOCK_CATALOG } from "@/lib/catalog";

export default function PropertiesPanel() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const node = useCanvasStore((s) =>
    s.doc.nodes.find((n) => n.id === s.selectedNodeId),
  );
  const renameNode = useCanvasStore((s) => s.renameNode);
  const setNodeConfig = useCanvasStore((s) => s.setNodeConfig);
  const removeNode = useCanvasStore((s) => s.removeNode);

  if (!selectedNodeId || !node) {
    return (
      <aside className="flex w-64 flex-col border-l border-border bg-bg-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Thuộc tính
          </h2>
        </div>
        <div className="p-4 text-sm text-fg-muted">
          Chọn một node để xem / sửa thuộc tính.
        </div>
      </aside>
    );
  }

  const profile = BLOCK_CATALOG[node.type];

  return (
    <aside className="flex w-64 flex-col border-l border-border bg-bg-panel">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Thuộc tính
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-fg-muted">Tên</span>
          <input
            value={node.label}
            onChange={(e) => renameNode(node.id, e.target.value)}
            className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-accent-dim"
          />
        </label>

        <div className="mb-3 rounded-md border border-border bg-bg p-3 text-xs">
          <div className="mb-1 flex justify-between">
            <span className="text-fg-muted">Loại</span>
            <span className="text-fg">{profile.label}</span>
          </div>
          <div className="mb-1 flex justify-between">
            <span className="text-fg-muted">Capacity</span>
            <span className="text-fg">
              {profile.capacityRps.toLocaleString()} rps
            </span>
          </div>
          <div className="mb-1 flex justify-between">
            <span className="text-fg-muted">Latency</span>
            <span className="text-fg">{profile.latencyMs} ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fg-muted">Stateful</span>
            <span className="text-fg">{profile.stateful ? "Có" : "Không"}</span>
          </div>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs text-fg-muted">Số replica</span>
          <input
            type="number"
            min={1}
            max={20}
            value={Number(node.config?.replicas ?? profile.defaultReplicas)}
            onChange={(e) =>
              setNodeConfig(node.id, "replicas", Math.max(1, Number(e.target.value)))
            }
            className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-accent-dim"
          />
        </label>

        <button
          onClick={() => removeNode(node.id)}
          className="w-full rounded-md border border-danger/40 px-3 py-2 text-sm text-danger transition hover:bg-danger/10"
        >
          Xoá node
        </button>
      </div>
    </aside>
  );
}
