import { describe, it, expect } from "vitest";
import { toMermaid } from "./mermaid";
import { toSkillMd } from "./skillmd";
import type { BlockTypeId, CanvasDocument, CanvasEdge, CanvasNode } from "@/lib/types";

function node(id: string, type: BlockTypeId, label?: string): CanvasNode {
  return { id, type, x: 0, y: 0, label: label ?? type, config: { replicas: 2 } };
}
function edge(source: string, target: string): CanvasEdge {
  return { id: `e_${source}_${target}`, source, target };
}
function doc(nodes: CanvasNode[], edges: CanvasEdge[], name = "Test Design"): CanvasDocument {
  return { nodes, edges, meta: { name } };
}

describe("toMermaid", () => {
  it("renders flowchart with nodes and edges", () => {
    const d = doc(
      [node("a", "client", "Client"), node("b", "webService", "API")],
      [edge("a", "b")],
    );
    const out = toMermaid(d);
    expect(out).toContain("flowchart LR");
    expect(out).toContain("Client");
    expect(out).toContain("API");
    expect(out).toContain("-->");
  });

  it("includes design name as comment", () => {
    const d = doc([], [], "My Arch");
    expect(toMermaid(d)).toContain("%% My Arch");
  });

  it("emits classDef for used categories", () => {
    const d = doc([node("a", "cache", "Redis")], []);
    const out = toMermaid(d);
    expect(out).toContain("classDef data");
    expect(out).toContain("#ef4444");
  });

  it("sanitizes weird ids", () => {
    const d = doc([node("weird id!@#", "client", "C")], []);
    const out = toMermaid(d);
    expect(out).not.toContain("weird id!@#");
    expect(out).toContain("C");
  });

  it("skips edges with missing endpoints", () => {
    const d = doc([node("a", "client", "C")], [edge("a", "ghost")]);
    const out = toMermaid(d);
    expect(out).not.toContain("-->");
  });
});

describe("toSkillMd", () => {
  it("renders title, components table, flow, validation", () => {
    const d = doc(
      [node("a", "client", "Client"), node("b", "relationalDb", "DB")],
      [edge("a", "b")],
      "Shop DB",
    );
    const out = toSkillMd(d);
    expect(out).toContain("# Shop DB");
    expect(out).toContain("## Components");
    expect(out).toContain("Client");
    expect(out).toContain("## Data flow");
    expect(out).toContain("Client → DB");
    expect(out).toContain("## Validation notes");
  });

  it("empty design renders placeholders", () => {
    const d = doc([], []);
    const out = toSkillMd(d);
    expect(out).toContain("no components yet");
    expect(out).toContain("no connections yet");
  });

  it("includes SPOF finding for single-replica db", () => {
    const n: CanvasNode = { id: "db", type: "relationalDb", x: 0, y: 0, label: "DB", config: { replicas: 1 } };
    const d = doc([n], []);
    const out = toSkillMd(d);
    expect(out).toContain("SPOF");
  });
});
