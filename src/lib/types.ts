/**
 * Portable graph model for a system-design canvas.
 *
 * This is the contract stored in designs.canvas_data (jsonb) and used by
 * every engine (validation, simulation, quiz) and exporter (PNG/Mermaid/SKILL.md).
 * Keep it framework-agnostic and serialisable.
 */

export type BlockTypeId =
  | "client"
  | "cdn"
  | "loadBalancer"
  | "apiGateway"
  | "webService"
  | "cache"
  | "relationalDb"
  | "nosqlDb"
  | "messageQueue"
  | "objectStorage"
  | "search"
  | "streamProc"
  | "authService"
  | "rateLimiter"
  | "waf"
  | "function"
  | "analytics";

/** Behavioural properties used by the simulation/validation engines. */
export interface BlockProfile {
  /** Max sustainable throughput, req/s. 0 = pass-through (no limit modeled). */
  capacityRps: number;
  /** Base processing latency in ms. */
  latencyMs: number;
  /** Does the node keep state / can fail independently? */
  stateful: boolean;
  /** Does a single instance represent a SPOF without a replica? */
  singleInstanceSpof: boolean;
  /** Default replication count when user doesn't set it. */
  defaultReplicas: number;
  /** Human label. */
  label: string;
  /** Short category for palette grouping. */
  category: "edge" | "compute" | "data" | "async" | "security" | "client";
  /** Accent color (hex) used on the canvas. */
  color: string;
}

export interface CanvasNode {
  id: string;
  type: BlockTypeId;
  x: number;
  y: number;
  label: string;
  /** Optional per-node overrides, e.g. replicas, capacity tweak. */
  config?: Record<string, unknown>;
}

export interface CanvasEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  /** Which logical port the edge leaves/enters (for multi-port nodes). */
  sourcePort?: string;
  targetPort?: string;
}

export interface CanvasMeta {
  name: string;
  description?: string;
  /** Grid size / viewport for round-tripping the editor. */
  viewport?: { scale: number; x: number; y: number };
}

export interface CanvasDocument {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  meta: CanvasMeta;
}

/** Result of a validation run. */
export type Severity = "error" | "warn" | "info";

export interface ValidationFinding {
  ruleId: string;
  severity: Severity;
  message: string;
  /** Node ids implicated (for highlighting). */
  nodeIds: string[];
  hint?: string;
}

export interface ValidationResult {
  findings: ValidationFinding[];
  errorCount: number;
  warnCount: number;
  infoCount: number;
  ok: boolean;
}

/** Result of a simulation run. */
export interface SimNodeStat {
  nodeId: string;
  label: string;
  utilization: number; // 0..1+
  dropped: number;
  avgLatencyMs: number;
  overloaded: boolean;
}

export interface SimulationResult {
  durationMs: number;
  throughput: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  nodeStats: SimNodeStat[];
  bottleneckNodeId?: string;
  failureInjected?: string; // node id
  survivedFailure: boolean;
}

/** Result of a quiz grading run. */
export interface QuizResult {
  problemSlug: string;
  score: number; // 0..100
  passed: boolean;
  checks: { label: string; passed: boolean; detail: string }[];
}
