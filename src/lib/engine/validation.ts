/**
 * Validation engine for a system-design canvas.
 *
 * Pure, framework-agnostic: takes a CanvasDocument and returns a
 * ValidationResult (contract defined in @/lib/types). No React, no DB.
 *
 * Rules implemented:
 *  - spof-single-replica : singleInstanceSpof node with replicas < 2  (error)
 *  - stateful-low-replica: stateful node with replicas < 2            (warn)
 *  - cycle-detected      : graph contains a cycle                     (error)
 *  - orphan-node         : node with no incident edges                (info)
 *  - client-disconnected : client node with no outgoing edge          (warn)
 *  - service-no-frontdoor: web/function service reached directly from client
 *                          with no gateway/LB/waf/rateLimiter in front (warn)
 *  - disconnected-graph  : more than one connected component          (info)
 */

import type {
  CanvasDocument,
  CanvasEdge,
  CanvasNode,
  ValidationFinding,
  ValidationResult,
} from "@/lib/types";
import { BLOCK_CATALOG } from "@/lib/catalog";

function replicasOf(node: CanvasNode): number {
  const cfg = node.config?.replicas;
  if (typeof cfg === "number" && Number.isFinite(cfg)) return cfg;
  return BLOCK_CATALOG[node.type].defaultReplicas;
}

/** Build undirected adjacency for component analysis. */
function buildAdjacency(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    if (!adj.has(e.source) || !adj.has(e.target)) continue;
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }
  return adj;
}

/** DFS cycle detection; returns the set of node ids that lie on any cycle. */
function findCycleNodes(nodes: CanvasNode[], edges: CanvasEdge[]): Set<string> {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (adj.has(e.source)) adj.get(e.source)!.push(e.target);
  }

  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  for (const n of nodes) color.set(n.id, WHITE);
  const cycleNodes = new Set<string>();

  // iterative DFS to avoid stack overflow on big graphs
  for (const start of nodes) {
    if (color.get(start.id) !== WHITE) continue;
    const stack: { id: string; idx: number; parent: string | null }[] = [
      { id: start.id, idx: 0, parent: null },
    ];
    color.set(start.id, GRAY);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const neighbors = adj.get(top.id) ?? [];
      if (top.idx < neighbors.length) {
        const next = neighbors[top.idx++];
        if (next === top.parent) continue;
        const c = color.get(next);
        if (c === GRAY) {
          // back-edge -> cycle; mark both ends + walk back the stack
          cycleNodes.add(next);
          cycleNodes.add(top.id);
          for (let i = stack.length - 2; i >= 0; i--) {
            cycleNodes.add(stack[i].id);
            if (stack[i].id === next) break;
          }
        } else if (c === WHITE) {
          color.set(next, GRAY);
          stack.push({ id: next, idx: 0, parent: top.id });
        }
      } else {
        color.set(top.id, BLACK);
        stack.pop();
      }
    }
  }
  return cycleNodes;
}

function countComponents(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): number {
  const adj = buildAdjacency(nodes, edges);
  const seen = new Set<string>();
  let components = 0;
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    components++;
    const queue = [n.id];
    seen.add(n.id);
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of adj.get(cur) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
  }
  return components;
}

const FRONTDOOR_TYPES = new Set([
  "loadBalancer",
  "apiGateway",
  "waf",
  "rateLimiter",
]);

export function validateDesign(doc: CanvasDocument): ValidationResult {
  const { nodes, edges } = doc;
  const findings: ValidationFinding[] = [];

  const incoming = new Map<string, CanvasEdge[]>();
  const outgoing = new Map<string, CanvasEdge[]>();
  for (const n of nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const e of edges) {
    if (outgoing.has(e.source)) outgoing.get(e.source)!.push(e);
    if (incoming.has(e.target)) incoming.get(e.target)!.push(e);
  }

  // ---- per-node rules ----
  for (const n of nodes) {
    const profile = BLOCK_CATALOG[n.type];
    const replicas = replicasOf(n);

    if (profile.singleInstanceSpof && replicas < 2) {
      findings.push({
        ruleId: "spof-single-replica",
        severity: "error",
        message: `${n.label} là single point of failure (SPOF) vì chỉ có ${replicas} replica.`,
        nodeIds: [n.id],
        hint: "Tăng số replica lên >= 2 hoặc thêm cơ chế failover.",
      });
    } else if (profile.stateful && replicas < 2) {
      findings.push({
        ruleId: "stateful-low-replica",
        severity: "warn",
        message: `${n.label} có trạng thái (stateful) nhưng chỉ có ${replicas} replica — rủi ro mất dữ liệu khi chết.`,
        nodeIds: [n.id],
        hint: "Tăng replica hoặc dùng shared storage / replication.",
      });
    }

    const hasEdge = (incoming.get(n.id)?.length ?? 0) > 0 || (outgoing.get(n.id)?.length ?? 0) > 0;
    if (!hasEdge) {
      findings.push({
        ruleId: "orphan-node",
        severity: "info",
        message: `${n.label} đứng một mình, không nối với node nào.`,
        nodeIds: [n.id],
        hint: "Nối nó vào luồng hoặc xoá nếu không dùng.",
      });
    }

    if (n.type === "client" && (outgoing.get(n.id)?.length ?? 0) === 0) {
      findings.push({
        ruleId: "client-disconnected",
        severity: "warn",
        message: "Client không kết nối tới bất kỳ thành phần nào.",
        nodeIds: [n.id],
        hint: "Nối client tới CDN / Load Balancer / API Gateway.",
      });
    }

    if ((n.type === "webService" || n.type === "function") && (incoming.get(n.id)?.length ?? 0) > 0) {
      const fromClients = incoming
        .get(n.id)!
        .some((e) => nodes.find((x) => x.id === e.source)?.type === "client");
      const fromFrontdoor = incoming
        .get(n.id)!
        .some((e) => FRONTDOOR_TYPES.has(nodes.find((x) => x.id === e.source)?.type ?? ""));
      if (fromClients && !fromFrontdoor) {
        findings.push({
          ruleId: "service-no-frontdoor",
          severity: "warn",
          message: `${n.label} nhận request trực tiếp từ Client mà không qua Load Balancer / API Gateway / WAF.`,
          nodeIds: [n.id],
          hint: "Thêm Load Balancer hoặc API Gateway đứng trước service.",
        });
      }
    }
  }

  // ---- graph-level rules ----
  const cycleNodes = findCycleNodes(nodes, edges);
  if (cycleNodes.size > 0) {
    findings.push({
      ruleId: "cycle-detected",
      severity: "error",
      message: `Phát hiện chu trình (cycle) trong đồ thị — luồng xử lý sẽ bị lặp vô hạn.`,
      nodeIds: [...cycleNodes],
      hint: "Rà soát các cạnh nối ngược (target -> source) và gỡ bỏ.",
    });
  }

  if (nodes.length > 0) {
    const comps = countComponents(nodes, edges);
    if (comps > 1) {
      findings.push({
        ruleId: "disconnected-graph",
        severity: "info",
        message: `Thiết kế có ${comps} cụm node không liên kết với nhau.`,
        nodeIds: [],
        hint: "Kiểm tra xem có thành phần bị lọt (không nối vào luồng chính).",
      });
    }
  }

  const errorCount = findings.filter((f) => f.severity === "error").length;
  const warnCount = findings.filter((f) => f.severity === "warn").length;
  const infoCount = findings.filter((f) => f.severity === "info").length;

  return {
    findings,
    errorCount,
    warnCount,
    infoCount,
    ok: errorCount === 0,
  };
}
