import { BLOCK_CATALOG } from "./catalog";
import type { BlockTypeId, CanvasDocument } from "./types";

export const MAX_NODES = 200;
export const MAX_EDGES = 500;
export const MAX_TITLE_LEN = 200;
export const MAX_DESC_LEN = 2000;
export const MAX_LABEL_LEN = 200;
export const MAX_ID_LEN = 100;
export const MAX_BODY_CHARS = 1_000_000;
export const COORD_BOUND = 100_000;
export const MAX_REPLICAS = 100;

export interface SchemaError {
  path: string;
  message: string;
}

export interface SchemaResult {
  ok: boolean;
  errors: SchemaError[];
  /** Sanitized document (unknown props stripped). Only set when ok. */
  doc?: CanvasDocument;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const BLOCK_TYPES = new Set<string>(Object.keys(BLOCK_CATALOG));

/**
 * Runtime validation for untrusted CanvasDocument JSON (Issue #2).
 * Pure function — no DB, no framework. Returns sanitized doc on success.
 */
export function validateCanvasDocument(raw: unknown): SchemaResult {
  const errors: SchemaError[] = [];
  const err = (path: string, message: string) => errors.push({ path, message });

  if (!isRecord(raw)) {
    return { ok: false, errors: [{ path: "$", message: "canvasData must be an object" }] };
  }

  // ---- nodes ----
  const nodes = raw.nodes;
  if (!Array.isArray(nodes)) {
    err("nodes", "nodes must be an array");
  } else if (nodes.length > MAX_NODES) {
    err("nodes", `too many nodes (max ${MAX_NODES})`);
  }
  const seenNodeIds = new Set<string>();
  const nodeList = Array.isArray(nodes) ? nodes : [];
  const cleanNodes: CanvasDocument["nodes"] = [];

  nodeList.forEach((n, i) => {
    const p = `nodes[${i}]`;
    if (!isRecord(n)) {
      err(p, "node must be an object");
      return;
    }
    let valid = true;
    if (typeof n.id !== "string" || !n.id || n.id.length > MAX_ID_LEN) {
      err(`${p}.id`, "id must be a non-empty string");
      valid = false;
    } else if (seenNodeIds.has(n.id)) {
      err(`${p}.id`, `duplicate node id "${n.id}"`);
      valid = false;
    }
    if (typeof n.type !== "string" || !BLOCK_TYPES.has(n.type)) {
      err(`${p}.type`, `unknown block type "${String(n.type)}"`);
      valid = false;
    }
    if (!isFiniteNumber(n.x) || Math.abs(n.x) > COORD_BOUND) {
      err(`${p}.x`, "x must be a finite number within bounds");
      valid = false;
    }
    if (!isFiniteNumber(n.y) || Math.abs(n.y) > COORD_BOUND) {
      err(`${p}.y`, "y must be a finite number within bounds");
      valid = false;
    }
    if (typeof n.label !== "string" || !n.label || n.label.length > MAX_LABEL_LEN) {
      err(`${p}.label`, "label must be a non-empty string");
      valid = false;
    }
    let config: Record<string, unknown> | undefined;
    if (n.config !== undefined) {
      if (!isRecord(n.config)) {
        err(`${p}.config`, "config must be an object");
        valid = false;
      } else {
        const rep = (n.config as Record<string, unknown>).replicas;
        if (
          rep !== undefined &&
          (!isFiniteNumber(rep) || !Number.isInteger(rep) || rep < 1 || rep > MAX_REPLICAS)
        ) {
          err(`${p}.config.replicas`, `replicas must be an integer 1..${MAX_REPLICAS}`);
          valid = false;
        }
        config = n.config as Record<string, unknown>;
      }
    }
    if (valid) {
      seenNodeIds.add(n.id as string);
      cleanNodes.push({
        id: n.id as string,
        type: n.type as BlockTypeId,
        x: n.x as number,
        y: n.y as number,
        label: n.label as string,
        ...(config !== undefined ? { config } : {}),
      });
    }
  });

  // ---- edges ----
  const edges = raw.edges;
  if (!Array.isArray(edges)) {
    err("edges", "edges must be an array");
  } else if (edges.length > MAX_EDGES) {
    err("edges", `too many edges (max ${MAX_EDGES})`);
  }
  const seenEdgeIds = new Set<string>();
  const edgeList = Array.isArray(edges) ? edges : [];
  const cleanEdges: CanvasDocument["edges"] = [];

  edgeList.forEach((e, i) => {
    const p = `edges[${i}]`;
    if (!isRecord(e)) {
      err(p, "edge must be an object");
      return;
    }
    let valid = true;
    if (typeof e.id !== "string" || !e.id || e.id.length > MAX_ID_LEN) {
      err(`${p}.id`, "id must be a non-empty string");
      valid = false;
    } else if (seenEdgeIds.has(e.id)) {
      err(`${p}.id`, `duplicate edge id "${e.id}"`);
      valid = false;
    }
    if (typeof e.source !== "string" || !seenNodeIds.has(e.source)) {
      err(`${p}.source`, `source references unknown node "${String(e.source)}"`);
      valid = false;
    }
    if (typeof e.target !== "string" || !seenNodeIds.has(e.target)) {
      err(`${p}.target`, `target references unknown node "${String(e.target)}"`);
      valid = false;
    }
    if (valid) {
      seenEdgeIds.add(e.id as string);
      cleanEdges.push({ id: e.id as string, source: e.source as string, target: e.target as string });
    }
  });

  // ---- meta ----
  const meta = raw.meta;
  if (!isRecord(meta)) {
    err("meta", "meta must be an object with a name");
  } else if (typeof meta.name !== "string" || !meta.name || meta.name.length > MAX_TITLE_LEN) {
    err("meta.name", "meta.name must be a non-empty string");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    errors: [],
    doc: {
      nodes: cleanNodes,
      edges: cleanEdges,
      meta: { name: (meta as Record<string, unknown>).name as string },
    },
  };
}

export function validateTitle(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return "Title required";
  if (raw.trim().length > MAX_TITLE_LEN) return `Title too long (max ${MAX_TITLE_LEN})`;
  return null;
}

export function validateDescription(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return "Description must be a string";
  if (raw.length > MAX_DESC_LEN) return `Description too long (max ${MAX_DESC_LEN})`;
  return null;
}

export function validateStatus(raw: unknown): string | null {
  if (raw === undefined) return null;
  if (raw !== "draft" && raw !== "published") return 'Status must be "draft" or "published"';
  return null;
}

export function validateIsPublic(raw: unknown): string | null {
  if (raw === undefined) return null;
  if (typeof raw !== "boolean") return "isPublic must be a boolean";
  return null;
}
