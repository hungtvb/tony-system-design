import { describe, it, expect } from "vitest";
import { validateDesign } from "./validation";
import type { BlockTypeId, CanvasDocument, CanvasEdge, CanvasNode } from "@/lib/types";

function node(id: string, type: BlockTypeId, config?: Record<string, unknown>): CanvasNode {
  return { id, type, x: 0, y: 0, label: type, config };
}
function edge(source: string, target: string): CanvasEdge {
  return { id: `e_${source}_${target}`, source, target };
}

function doc(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasDocument {
  return { nodes, edges, meta: { name: "test" } };
}

describe("validateDesign", () => {
  it("flags single-instance SPOF with <2 replicas as error", () => {
    const d = doc([node("db", "relationalDb", { replicas: 1 })], []);
    const r = validateDesign(d);
    expect(r.ok).toBe(false);
    expect(r.errorCount).toBeGreaterThanOrEqual(1);
    expect(r.findings.some((f) => f.ruleId === "spof-single-replica")).toBe(true);
  });

  it("passes a web service with >=2 replicas", () => {
    const d = doc([node("ws", "webService", { replicas: 3 })], []);
    const r = validateDesign(d);
    expect(r.findings.some((f) => f.ruleId === "spof-single-replica" && f.nodeIds.includes("ws"))).toBe(false);
  });

  it("warns on stateful node with <2 replicas (non-SPOF)", () => {
    const d = doc([node("st", "objectStorage", { replicas: 1 })], []);
    const r = validateDesign(d);
    expect(r.findings.some((f) => f.ruleId === "stateful-low-replica")).toBe(true);
    expect(r.ok).toBe(true);
  });

  it("detects a cycle of 3 nodes", () => {
    const d = doc(
      [node("a", "webService", { replicas: 3 }), node("b", "cache", { replicas: 3 }), node("c", "search", { replicas: 3 })],
      [edge("a", "b"), edge("b", "c"), edge("c", "a")],
    );
    const r = validateDesign(d);
    expect(r.errorCount).toBeGreaterThanOrEqual(1);
    const cyc = r.findings.find((f) => f.ruleId === "cycle-detected");
    expect(cyc).toBeDefined();
    expect(cyc!.nodeIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("no cycle in a simple chain", () => {
    const d = doc(
      [node("c", "client"), node("lb", "loadBalancer", { replicas: 2 }), node("ws", "webService", { replicas: 3 })],
      [edge("c", "lb"), edge("lb", "ws")],
    );
    const r = validateDesign(d);
    expect(r.findings.some((f) => f.ruleId === "cycle-detected")).toBe(false);
  });

  it("flags orphan node as info", () => {
    const d = doc([node("ws", "webService", { replicas: 3 }), node("lonely", "cache", { replicas: 3 })], []);
    const r = validateDesign(d);
    expect(r.findings.some((f) => f.ruleId === "orphan-node")).toBe(true);
  });

  it("warns when client is disconnected", () => {
    const d = doc([node("c", "client"), node("ws", "webService", { replicas: 3 })], []);
    const r = validateDesign(d);
    expect(r.findings.some((f) => f.ruleId === "client-disconnected")).toBe(true);
  });

  it("warns when service receives traffic directly from client without frontdoor", () => {
    const d = doc(
      [node("c", "client"), node("ws", "webService", { replicas: 3 })],
      [edge("c", "ws")],
    );
    const r = validateDesign(d);
    expect(r.findings.some((f) => f.ruleId === "service-no-frontdoor")).toBe(true);
  });

  it("does NOT warn when service is behind a gateway", () => {
    const d = doc(
      [node("c", "client"), node("gw", "apiGateway", { replicas: 2 }), node("ws", "webService", { replicas: 3 })],
      [edge("c", "gw"), edge("gw", "ws")],
    );
    const r = validateDesign(d);
    expect(r.findings.some((f) => f.ruleId === "service-no-frontdoor")).toBe(false);
  });

  it("reports disconnected components as info", () => {
    const d = doc(
      [node("c", "client"), node("lb", "loadBalancer", { replicas: 2 }), node("ws", "webService", { replicas: 3 }), node("db", "relationalDb", { replicas: 3 })],
      [edge("c", "lb"), edge("lb", "ws")],
    );
    const r = validateDesign(d);
    expect(r.findings.some((f) => f.ruleId === "disconnected-graph")).toBe(true);
  });

  it("sanity: a well-formed design validates clean (no errors)", () => {
    const d = doc(
      [
        node("c", "client"),
        node("cdn", "cdn"),
        node("lb", "loadBalancer", { replicas: 2 }),
        node("gw", "apiGateway", { replicas: 2 }),
        node("ws", "webService", { replicas: 3 }),
        node("cache", "cache", { replicas: 3 }),
        node("db", "relationalDb", { replicas: 3 }),
      ],
      [edge("c", "cdn"), edge("cdn", "lb"), edge("lb", "gw"), edge("gw", "ws"), edge("ws", "cache"), edge("ws", "db")],
    );
    const r = validateDesign(d);
    expect(r.ok).toBe(true);
    expect(r.errorCount).toBe(0);
  });
});
