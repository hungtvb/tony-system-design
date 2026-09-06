import { describe, it, expect } from "vitest";
import { simulateDesign } from "./simulation";
import type { CanvasDocument } from "@/lib/types";

function node(id: string, type: any, config?: Record<string, unknown>) {
  return { id, type, x: 0, y: 0, label: type, config };
}
function edge(source: string, target: string) {
  return { id: `e_${source}_${target}`, source, target };
}
function doc(nodes: any[], edges: any[]): CanvasDocument {
  return { nodes, edges, meta: { name: "test" } };
}

describe("simulateDesign", () => {
  it("simple chain: client -> LB -> webService -> DB", () => {
    const d = doc(
      [
        node("c", "client"),
        node("lb", "loadBalancer", { replicas: 2 }),
        node("ws", "webService", { replicas: 3 }),
        node("db", "relationalDb", { replicas: 3 }),
      ],
      [edge("c", "lb"), edge("lb", "ws"), edge("ws", "db")],
    );
    const r = simulateDesign(d, 1000);
    expect(r.throughput).toBeCloseTo(1000, -1); // ~1000
    expect(r.errorRate).toBeLessThan(0.01);
    expect(r.p50Ms).toBeGreaterThan(0);
    expect(r.nodeStats.length).toBe(4);
  });

  it("bottleneck at webService capacity (5000 rps * 3 replicas = 15000), load 20000 => overload", () => {
    const d = doc(
      [
        node("c", "client"),
        node("lb", "loadBalancer", { replicas: 2 }),
        node("ws", "webService", { replicas: 3 }),
        node("db", "relationalDb", { replicas: 3 }),
      ],
      [edge("c", "lb"), edge("lb", "ws"), edge("ws", "db")],
    );
    const r = simulateDesign(d, 20000);
    expect(r.errorRate).toBeGreaterThan(0);
    expect(r.bottleneckNodeId).toBe("ws");
    expect(r.throughput).toBeLessThan(20000);
  });

  it("CDN absorbs most load (capacity 200k) - but webService is bottleneck", () => {
    const d = doc(
      [
        node("c", "client"),
        node("cdn", "cdn"),
        node("ws", "webService", { replicas: 10 }), // enough capacity
      ],
      [edge("c", "cdn"), edge("cdn", "ws")],
    );
    const r = simulateDesign(d, 50000);
    expect(r.errorRate).toBeLessThan(0.01);
    expect(r.throughput).toBeCloseTo(50000, -2);
  });

  it("failure injection kills node, other nodes survive if capacity ok", () => {
    const d = doc(
      [
        node("c", "client"),
        node("lb", "loadBalancer", { replicas: 2 }),
        node("ws", "webService", { replicas: 3 }),
        node("db", "relationalDb", { replicas: 3 }),
      ],
      [edge("c", "lb"), edge("lb", "ws"), edge("ws", "db")],
    );
    const r = simulateDesign(d, 1000, "lb");
    expect(r.failureInjected).toBe("lb");
    expect(r.survivedFailure).toBe(false); // LB is SPOF, load drops to 0
  });

  it("failure injection on non-critical node (cache) survives - throughput halves", () => {
    const d = doc(
      [
        node("c", "client"),
        node("lb", "loadBalancer", { replicas: 2 }),
        node("ws", "webService", { replicas: 3 }),
        node("cache", "cache", { replicas: 3 }),
        node("db", "relationalDb", { replicas: 3 }),
      ],
      [edge("c", "lb"), edge("lb", "ws"), edge("ws", "cache"), edge("ws", "db")],
    );
    const r = simulateDesign(d, 1000, "cache");
    expect(r.failureInjected).toBe("cache");
    // cache is one of two children of ws -> half traffic dropped
    expect(r.survivedFailure).toBe(true);
    expect(r.throughput).toBeCloseTo(500, -1);
  });

  it("empty doc returns zero result", () => {
    const d = doc([], []);
    const r = simulateDesign(d, 1000);
    expect(r.throughput).toBe(0);
    expect(r.errorRate).toBe(1);
  });

  it("no client node: uses first topo node as entry", () => {
    const d = doc(
      [
        node("ws", "webService", { replicas: 3 }),
        node("db", "relationalDb", { replicas: 3 }),
      ],
      [edge("ws", "db")],
    );
    const r = simulateDesign(d, 500);
    expect(r.throughput).toBeGreaterThan(0);
  });

  it("fan-out: webService -> cache + db (split traffic)", () => {
    const d = doc(
      [
        node("c", "client"),
        node("ws", "webService", { replicas: 3 }),
        node("cache", "cache", { replicas: 3 }),
        node("db", "relationalDb", { replicas: 3 }),
      ],
      [edge("c", "ws"), edge("ws", "cache"), edge("ws", "db")],
    );
    const r = simulateDesign(d, 1000);
    // half to cache, half to db
    expect(r.throughput).toBeCloseTo(1000, -1);
    const cacheStat = r.nodeStats.find((s) => s.label === "Cache (Redis)");
    const dbStat = r.nodeStats.find((s) => s.label === "Relational DB");
    expect(cacheStat?.utilization).toBeLessThan(1);
    expect(dbStat?.utilization).toBeLessThan(1);
  });
});