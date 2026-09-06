/**
 * Simulation engine for a system-design canvas.
 *
 * Pure, framework-agnostic: takes a CanvasDocument + load (req/s) and returns
 * a SimulationResult (contract in @/lib/types).
 *
 * Model: M/M/k queue per node (k = replicas). Simple steady-state approximation:
 *  - utilization ρ = λ / (k * μ) where μ = capacityRps per replica
 *  - latency = base_latency / (1 - ρ)  (for ρ < 1)
 *  - dropped = λ * max(0, ρ - 1)       (overflow when ρ >= 1)
 *  - total throughput = sum of successful throughput across sink nodes
 */

import type {
  CanvasDocument,
  CanvasNode,
  CanvasEdge,
  SimulationResult,
  SimNodeStat,
} from "@/lib/types";
import { BLOCK_CATALOG } from "@/lib/catalog";

function replicasOf(node: CanvasNode): number {
  const cfg = node.config?.replicas;
  if (typeof cfg === "number" && Number.isFinite(cfg) && cfg > 0) return cfg;
  return BLOCK_CATALOG[node.type].defaultReplicas;
}

function profileOf(node: CanvasNode) {
  return BLOCK_CATALOG[node.type];
}

function buildAdj(nodes: CanvasNode[], edges: CanvasEdge[]) {
  const out = new Map<string, CanvasEdge[]>();
  const inMap = new Map<string, CanvasEdge[]>();
  for (const n of nodes) {
    out.set(n.id, []);
    inMap.set(n.id, []);
  }
  for (const e of edges) {
    if (out.has(e.source)) out.get(e.source)!.push(e);
    if (inMap.has(e.target)) inMap.get(e.target)!.push(e);
  }
  return { out, in: inMap };
}

function topoSort(nodes: CanvasNode[], out: Map<string, CanvasEdge[]>): CanvasNode[] {
  const indeg = new Map<string, number>();
  for (const n of nodes) indeg.set(n.id, 0);
  for (const n of nodes) {
    for (const e of out.get(n.id) ?? []) {
      if (indeg.has(e.target)) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    }
  }
  const q = [...nodes].filter((n) => indeg.get(n.id) === 0);
  const order: CanvasNode[] = [];
  while (q.length) {
    const cur = q.shift()!;
    order.push(cur);
    for (const e of out.get(cur.id) ?? []) {
      if (!indeg.has(e.target)) continue;
      indeg.set(e.target, indeg.get(e.target)! - 1);
      if (indeg.get(e.target) === 0) {
        q.push(nodes.find((x) => x.id === e.target)!);
      }
    }
  }
  return order.length === nodes.length ? order : nodes;
}

function findSinks(nodes: CanvasNode[], out: Map<string, CanvasEdge[]>): CanvasNode[] {
  return nodes.filter((n) => (out.get(n.id) ?? []).length === 0);
}

function findClient(nodes: CanvasNode[]): CanvasNode | undefined {
  return nodes.find((n) => n.type === "client");
}

interface NodeMetrics {
  nodeId: string;
  label: string;
  profileLabel: string;
  arrivalRate: number;
  capacity: number;
  utilization: number;
  dropped: number;
  latencyMs: number;
  overloaded: boolean;
}

export function simulateDesign(
  doc: CanvasDocument,
  inputRps: number,
  failureNodeId?: string,
): SimulationResult {
  const { nodes, edges } = doc;
  if (nodes.length === 0) {
    return emptyResult(inputRps, failureNodeId);
  }

  const { out, in: inMap } = buildAdj(nodes, edges);
  const order = topoSort(nodes, out);
  const sinks = findSinks(nodes, out);
  const client = findClient(nodes);

  const arrival = new Map<string, number>();
  if (client) arrival.set(client.id, inputRps);
  else {
    arrival.set(order[0]?.id ?? "", inputRps);
  }

  const metrics = new Map<string, NodeMetrics>();

  for (const n of order) {
    const λ = arrival.get(n.id) ?? 0;
    const profile = profileOf(n);
    const k = replicasOf(n);
    const μ = profile.capacityRps > 0 ? profile.capacityRps : Infinity;
    const totalCap = μ * k;

    let utilization = totalCap > 0 ? λ / totalCap : 0;
    let dropped = 0;
    let latency = profile.latencyMs;

    if (totalCap > 0 && utilization > 1) {
      dropped = λ * (1 - 1 / utilization);
      utilization = 1;
    }
    if (totalCap > 0 && utilization > 0 && utilization < 1) {
      latency = profile.latencyMs / (1 - utilization);
    } else if (utilization >= 1) {
      latency = profile.latencyMs * 10;
    }

    if (failureNodeId && failureNodeId === n.id) {
      utilization = 1;
      dropped = λ;
      latency = profile.latencyMs * 100;
    }

    metrics.set(n.id, {
      nodeId: n.id,
      label: n.label,
      profileLabel: profile.label,
      arrivalRate: λ,
      capacity: totalCap,
      utilization,
      dropped,
      latencyMs: latency,
      overloaded: utilization >= 1 || dropped > 0,
    });

    const successful = λ - dropped;
    const children = out.get(n.id) ?? [];
    if (children.length > 0) {
      const perChild = successful / children.length;
      for (const e of children) {
        arrival.set(e.target, (arrival.get(e.target) ?? 0) + perChild);
      }
    }
  }

  // Aggregate: throughput at sinks, but errorRate = total dropped everywhere / input
  let totalThroughput = 0;
  let totalLatencySum = 0;
  let totalLatencyWeight = 0;
  let maxUtil = 0;
  let bottleneckId: string | undefined;
  let totalDropped = 0;

  for (const m of metrics.values()) {
    totalDropped += m.dropped;
    if (m.utilization > maxUtil) {
      maxUtil = m.utilization;
      bottleneckId = m.nodeId;
    }
  }

  for (const s of sinks) {
    const m = metrics.get(s.id);
    if (!m) continue;
    totalThroughput += m.arrivalRate - m.dropped;
    totalLatencySum += m.latencyMs * (m.arrivalRate - m.dropped);
    totalLatencyWeight += m.arrivalRate - m.dropped;
  }

  const avgLatency = totalLatencyWeight > 0 ? totalLatencySum / totalLatencyWeight : 0;
  const p50 = avgLatency;
  const p95 = avgLatency * 1.5;
  const p99 = avgLatency * 2.5;
  const errorRate = inputRps > 0 ? totalDropped / inputRps : 0;

  const nodeStats: SimNodeStat[] = [...metrics.values()].map((m) => ({
    nodeId: m.nodeId,
    label: m.profileLabel,
    utilization: m.utilization,
    dropped: m.dropped,
    avgLatencyMs: m.latencyMs,
    overloaded: m.overloaded,
  }));

  let survivedFailure = false;
  if (failureNodeId) {
    const failed = metrics.get(failureNodeId);
    const others = [...metrics.values()].filter((m) => m.nodeId !== failureNodeId);
    const allOthersOk = others.every((m) => m.utilization < 1 && m.dropped === 0);
    survivedFailure = allOthersOk && (failed?.dropped ?? 0) > 0 && totalThroughput > 0;
  }

  return {
    durationMs: 1000,
    throughput: totalThroughput,
    p50Ms: p50,
    p95Ms: p95,
    p99Ms: p99,
    errorRate,
    nodeStats,
    bottleneckNodeId: bottleneckId,
    failureInjected: failureNodeId,
    survivedFailure,
  };
}

function emptyResult(inputRps: number, failureNodeId?: string): SimulationResult {
  return {
    durationMs: 0,
    throughput: 0,
    p50Ms: 0,
    p95Ms: 0,
    p99Ms: 0,
    errorRate: 1,
    nodeStats: [],
    bottleneckNodeId: undefined,
    failureInjected: failureNodeId,
    survivedFailure: false,
  };
}