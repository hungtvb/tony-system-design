import { describe, it, expect } from "vitest";
import { gradeDesign, listProblems, QUIZ_PROBLEMS } from "./quiz";
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

const R3 = { replicas: 3 };

describe("quiz engine", () => {
  it("lists problems", () => {
    const list = listProblems();
    expect(list.length).toBe(QUIZ_PROBLEMS.length);
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const p of list) {
      expect(p.slug).toBeTruthy();
      expect(p.title).toBeTruthy();
    }
  });

  it("url-shortener: full design passes", () => {
    const d = doc(
      [
        node("c", "client"),
        node("lb", "loadBalancer", { replicas: 2 }),
        node("ws", "webService", R3),
        node("cache", "cache", R3),
        node("db", "relationalDb", R3),
      ],
      [edge("c", "lb"), edge("lb", "ws"), edge("ws", "cache"), edge("ws", "db")],
    );
    const r = gradeDesign(d, "url-shortener");
    expect(r.problemSlug).toBe("url-shortener");
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("url-shortener: missing cache fails that check", () => {
    const d = doc(
      [
        node("c", "client"),
        node("lb", "loadBalancer", { replicas: 2 }),
        node("ws", "webService", R3),
        node("db", "relationalDb", R3),
      ],
      [edge("c", "lb"), edge("lb", "ws"), edge("ws", "db")],
    );
    const r = gradeDesign(d, "url-shortener");
    expect(r.score).toBeLessThan(100);
    const cacheCheck = r.checks.find((c) => c.label.includes("Cache"));
    expect(cacheCheck?.passed).toBe(false);
  });

  it("url-shortener: SPOF db fails no-spof check", () => {
    const d = doc(
      [
        node("c", "client"),
        node("ws", "webService", R3),
        node("cache", "cache", R3),
        node("db", "relationalDb", { replicas: 1 }),
      ],
      [edge("c", "ws"), edge("ws", "cache"), edge("ws", "db")],
    );
    const r = gradeDesign(d, "url-shortener");
    const spof = r.checks.find((c) => c.label.includes("SPOF"));
    expect(spof?.passed).toBe(false);
  });

  it("rate-limited-api: full design passes", () => {
    const d = doc(
      [
        node("c", "client"),
        node("gw", "apiGateway", { replicas: 2 }),
        node("rl", "rateLimiter", { replicas: 2 }),
        node("ws", "webService", R3),
      ],
      [edge("c", "gw"), edge("gw", "rl"), edge("rl", "ws")],
    );
    const r = gradeDesign(d, "rate-limited-api");
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("rate-limited-api: missing rate limiter lowers score", () => {
    const d = doc(
      [
        node("c", "client"),
        node("gw", "apiGateway", { replicas: 2 }),
        node("ws", "webService", R3),
      ],
      [edge("c", "gw"), edge("gw", "ws")],
    );
    const r = gradeDesign(d, "rate-limited-api");
    expect(r.score).toBe(80);
    const rl = r.checks.find((c) => c.label.includes("Rate Limiter"));
    expect(rl?.passed).toBe(false);
  });

  it("rate-limited-api: missing 2 checks fails", () => {
    const d = doc([node("ws", "webService", R3)], []);
    const r = gradeDesign(d, "rate-limited-api");
    expect(r.passed).toBe(false);
  });

  it("realtime-feed: full design passes", () => {
    const d = doc(
      [
        node("c", "client"),
        node("ws", "webService", R3),
        node("mq", "messageQueue", R3),
        node("cache", "cache", R3),
        node("db", "nosqlDb", R3),
      ],
      [edge("c", "ws"), edge("ws", "mq"), edge("mq", "cache"), edge("mq", "db")],
    );
    const r = gradeDesign(d, "realtime-feed");
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("unknown problem slug returns 0", () => {
    const d = doc([], []);
    const r = gradeDesign(d, "nope");
    expect(r.score).toBe(0);
    expect(r.passed).toBe(false);
  });
});
