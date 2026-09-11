import { describe, it, expect } from "vitest";
import {
  validateCanvasDocument,
  validateTitle,
  validateStatus,
  validateIsPublic,
  MAX_NODES,
  MAX_EDGES,
} from "./canvas-schema";

function validDoc() {
  return {
    nodes: [
      { id: "c", type: "client", x: 0, y: 0, label: "Client" },
      { id: "ws", type: "webService", x: 100, y: 0, label: "API", config: { replicas: 3 } },
    ],
    edges: [{ id: "e1", source: "c", target: "ws" }],
    meta: { name: "Demo" },
  };
}

describe("validateCanvasDocument", () => {
  it("accepts a valid document and strips unknown props", () => {
    const raw = { ...validDoc(), extra: "drop me" };
    const r = validateCanvasDocument(raw);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.doc?.nodes).toHaveLength(2);
    expect(r.doc?.edges).toHaveLength(1);
    expect(r.doc?.meta.name).toBe("Demo");
    expect(r.doc).not.toHaveProperty("extra");
  });

  it("rejects non-object input", () => {
    expect(validateCanvasDocument(null).ok).toBe(false);
    expect(validateCanvasDocument("x").ok).toBe(false);
    expect(validateCanvasDocument([]).ok).toBe(false);
  });

  it("rejects unknown block type", () => {
    const raw = validDoc();
    raw.nodes[0] = { ...raw.nodes[0], type: "evilBlock" };
    const r = validateCanvasDocument(raw);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path.includes("type"))).toBe(true);
  });

  it("rejects duplicate node ids", () => {
    const raw = validDoc();
    raw.nodes.push({ id: "c", type: "cdn", x: 0, y: 0, label: "Dup" });
    const r = validateCanvasDocument(raw);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes("duplicate"))).toBe(true);
  });

  it("rejects edge referencing unknown node", () => {
    const raw = validDoc();
    raw.edges.push({ id: "eX", source: "ghost", target: "ws" });
    const r = validateCanvasDocument(raw);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path.includes("source"))).toBe(true);
  });

  it("rejects duplicate edge ids", () => {
    const raw = validDoc();
    raw.edges.push({ id: "e1", source: "c", target: "ws" });
    const r = validateCanvasDocument(raw);
    expect(r.ok).toBe(false);
  });

  it("rejects NaN / infinite / out-of-bounds coordinates", () => {
    for (const bad of [NaN, Infinity, 1e9]) {
      const raw = validDoc();
      raw.nodes[0] = { ...raw.nodes[0], x: bad as number };
      expect(validateCanvasDocument(raw).ok).toBe(false);
    }
  });

  it("rejects invalid replicas", () => {
    for (const bad of [0, -1, 1.5, 101, "3"]) {
      const raw = validDoc();
      raw.nodes[1] = { ...raw.nodes[1], config: { replicas: bad as number } };
      const r = validateCanvasDocument(raw);
      expect(r.ok).toBe(false);
    }
  });

  it("rejects missing/invalid meta", () => {
    expect(validateCanvasDocument({ ...validDoc(), meta: undefined }).ok).toBe(false);
    expect(validateCanvasDocument({ ...validDoc(), meta: {} }).ok).toBe(false);
  });

  it("rejects oversized payloads", () => {
    const nodes = Array.from({ length: MAX_NODES + 1 }, (_, i) => ({
      id: `n${i}`, type: "client", x: 0, y: 0, label: "N",
    }));
    expect(validateCanvasDocument({ nodes, edges: [], meta: { name: "x" } }).ok).toBe(false);
    const edges = Array.from({ length: MAX_EDGES + 1 }, (_, i) => ({
      id: `e${i}`, source: "a", target: "a",
    }));
    const r = validateCanvasDocument({
      nodes: [{ id: "a", type: "client", x: 0, y: 0, label: "A" }],
      edges,
      meta: { name: "x" },
    });
    expect(r.ok).toBe(false);
  });
});

describe("field validators", () => {
  it("validateTitle", () => {
    expect(validateTitle("")).not.toBeNull();
    expect(validateTitle("  ")).not.toBeNull();
    expect(validateTitle("ok")).toBeNull();
    expect(validateTitle("x".repeat(201))).not.toBeNull();
  });
  it("validateStatus", () => {
    expect(validateStatus(undefined)).toBeNull();
    expect(validateStatus("draft")).toBeNull();
    expect(validateStatus("nope")).not.toBeNull();
  });
  it("validateIsPublic", () => {
    expect(validateIsPublic(undefined)).toBeNull();
    expect(validateIsPublic(true)).toBeNull();
    expect(validateIsPublic("yes")).not.toBeNull();
  });
});
