import { create } from "zustand";
import type { BlockTypeId, CanvasDocument, CanvasEdge, CanvasNode } from "@/lib/types";
import { BLOCK_CATALOG } from "@/lib/catalog";

const NODE_PROFILES = BLOCK_CATALOG;

let idCounter = 0;
function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

interface CanvasState {
  doc: CanvasDocument;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  connectingFrom: string | null;
  /** bumped on every change to trigger autosave debounce. */
  revision: number;

  addNode: (type: BlockTypeId, x: number, y: number) => void;
  moveNode: (id: string, x: number, y: number) => void;
  removeNode: (id: string) => void;
  renameNode: (id: string, label: string) => void;
  setNodeConfig: (id: string, key: string, value: unknown) => void;

  addEdge: (source: string, target: string) => void;
  removeEdge: (id: string) => void;

  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setConnecting: (id: string | null) => void;

  loadDoc: (doc: CanvasDocument) => void;
  reset: () => void;
}

const emptyDoc = (): CanvasDocument => ({
  nodes: [],
  edges: [],
  meta: { name: "Untitled design" },
});

export const useCanvasStore = create<CanvasState>((set) => ({
  doc: emptyDoc(),
  selectedNodeId: null,
  selectedEdgeId: null,
  connectingFrom: null,
  revision: 0,

  addNode: (type, x, y) =>
    set((s) => {
      const profile = NODE_PROFILES[type];
      const node: CanvasNode = {
        id: uid("n"),
        type,
        x,
        y,
        label: profile.label,
        config: { replicas: profile.defaultReplicas },
      };
      return {
        doc: { ...s.doc, nodes: [...s.doc.nodes, node] },
        selectedNodeId: node.id,
        revision: s.revision + 1,
      };
    }),

  moveNode: (id, x, y) =>
    set((s) => ({
      doc: {
        ...s.doc,
        nodes: s.doc.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
      },
      revision: s.revision + 1,
    })),

  removeNode: (id) =>
    set((s) => ({
      doc: {
        ...s.doc,
        nodes: s.doc.nodes.filter((n) => n.id !== id),
        edges: s.doc.edges.filter((e) => e.source !== id && e.target !== id),
      },
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      revision: s.revision + 1,
    })),

  renameNode: (id, label) =>
    set((s) => ({
      doc: {
        ...s.doc,
        nodes: s.doc.nodes.map((n) => (n.id === id ? { ...n, label } : n)),
      },
      revision: s.revision + 1,
    })),

  setNodeConfig: (id, key, value) =>
    set((s) => ({
      doc: {
        ...s.doc,
        nodes: s.doc.nodes.map((n) =>
          n.id === id
            ? { ...n, config: { ...n.config, [key]: value } }
            : n,
        ),
      },
      revision: s.revision + 1,
    })),

  addEdge: (source, target) =>
    set((s) => {
      if (source === target) return s;
      const exists = s.doc.edges.some(
        (e) => e.source === source && e.target === target,
      );
      if (exists) return s;
      const edge: CanvasEdge = { id: uid("e"), source, target };
      return {
        doc: { ...s.doc, edges: [...s.doc.edges, edge] },
        selectedEdgeId: edge.id,
        revision: s.revision + 1,
      };
    }),

  removeEdge: (id) =>
    set((s) => ({
      doc: { ...s.doc, edges: s.doc.edges.filter((e) => e.id !== id) },
      selectedEdgeId: s.selectedEdgeId === id ? null : s.selectedEdgeId,
      revision: s.revision + 1,
    })),

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  setConnecting: (id: string | null) => set({ connectingFrom: id }),

  loadDoc: (doc) =>
    set({
      doc,
      selectedNodeId: null,
      selectedEdgeId: null,
      connectingFrom: null,
      revision: 0,
    }),

  reset: () =>
    set({
      doc: emptyDoc(),
      selectedNodeId: null,
      selectedEdgeId: null,
      connectingFrom: null,
      revision: 0,
    }),
}));
