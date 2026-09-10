/**
 * Quiz grading engine for tony-system-design.
 *
 * Defines a small set of teaching problems. Each problem is a list of
 * checks over the CanvasDocument. gradeDesign() runs the checks and
 * returns a QuizResult (contract in @/lib/types).
 *
 * Checks reuse validateDesign() where appropriate (SPOF / cycle).
 */

import type { CanvasDocument, QuizResult } from "@/lib/types";
import { validateDesign } from "./validation";

export interface QuizCheckDef {
  id: string;
  label: string;
  run: (doc: CanvasDocument) => { passed: boolean; detail: string };
}

export interface QuizProblem {
  slug: string;
  title: string;
  description: string;
  passScore: number;
  checks: QuizCheckDef[];
}

function hasType(doc: CanvasDocument, ...types: string[]): boolean {
  return doc.nodes.some((n) => types.includes(n.type));
}

function hasEdgeBetween(
  doc: CanvasDocument,
  fromTypes: string[],
  toTypes: string[],
): boolean {
  const byId = new Map<string, string>(doc.nodes.map((n) => [n.id, n.type]));
  return doc.edges.some((e) => {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    return s && t && fromTypes.includes(s) && toTypes.includes(t);
  });
}

function checkNoSpof(): QuizCheckDef {
  return {
    id: "no-spof",
    label: "Khong co SPOF",
    run: (doc) => {
      const r = validateDesign(doc);
      const spof = r.findings.filter(
        (f) => f.ruleId === "spof-single-replica",
      );
      return spof.length === 0
        ? { passed: true, detail: "Khong phat hien SPOF." }
        : {
            passed: false,
            detail: `${spof.length} node SPOF: ${spof.map((f) => f.message).join("; ")}`,
          };
    },
  };
}

function checkNoCycle(): QuizCheckDef {
  return {
    id: "no-cycle",
    label: "Khong co chu trinh",
    run: (doc) => {
      const r = validateDesign(doc);
      const cyc = r.findings.filter((f) => f.ruleId === "cycle-detected");
      return cyc.length === 0
        ? { passed: true, detail: "Do thi khong co cycle." }
        : { passed: false, detail: "Do thi co chu trinh — hay go bo canh noi nguoc." };
    },
  };
}

function checkClientConnected(): QuizCheckDef {
  return {
    id: "client-connected",
    label: "Client duoc noi vao he thong",
    run: (doc) => {
      const hasClient = hasType(doc, "client");
      if (!hasClient)
        return { passed: false, detail: "Thieu node Client." };
      const ok = hasEdgeBetween(doc, ["client"], [
        "cdn",
        "loadBalancer",
        "apiGateway",
        "waf",
        "webService",
        "function",
      ]);
      return ok
        ? { passed: true, detail: "Client da noi vao he thong." }
        : { passed: false, detail: "Client chua noi toi thanh phan nao." };
    },
  };
}

export const QUIZ_PROBLEMS: QuizProblem[] = [
  {
    slug: "url-shortener",
    title: "Rut gon URL",
    description:
      "Thiet ke dich vu rut gon URL doc-nang: can service, database, cache.",
    passScore: 80,
    checks: [
      {
        id: "has-service",
        label: "Co Web Service hoac Function",
        run: (doc) =>
          hasType(doc, "webService", "function")
            ? { passed: true, detail: "Da co service xu ly." }
            : { passed: false, detail: "Thieu Web Service / Function." },
      },
      {
        id: "has-database",
        label: "Co Database luu mapping",
        run: (doc) =>
          hasType(doc, "relationalDb", "nosqlDb")
            ? { passed: true, detail: "Da co database." }
            : { passed: false, detail: "Thieu database (SQL/NoSQL)." },
      },
      {
        id: "has-cache",
        label: "Co Cache cho duong doc",
        run: (doc) =>
          hasType(doc, "cache")
            ? { passed: true, detail: "Da co cache." }
            : {
                passed: false,
                detail: "Nen them Cache (Redis) vi doc nhieu hon ghi.",
              },
      },
      checkClientConnected(),
      checkNoSpof(),
    ],
  },
  {
    slug: "rate-limited-api",
    title: "API co Rate Limit",
    description: "Thiet ke API gateway co bao ve: gateway, rate limiter, auth.",
    passScore: 80,
    checks: [
      {
        id: "has-frontdoor",
        label: "Co Gateway hoac Load Balancer",
        run: (doc) =>
          hasType(doc, "apiGateway", "loadBalancer")
            ? { passed: true, detail: "Da co frontdoor." }
            : { passed: false, detail: "Thieu API Gateway / Load Balancer." },
      },
      {
        id: "has-ratelimiter",
        label: "Co Rate Limiter",
        run: (doc) =>
          hasType(doc, "rateLimiter")
            ? { passed: true, detail: "Da co rate limiter." }
            : { passed: false, detail: "Thieu Rate Limiter." },
      },
      {
        id: "has-service",
        label: "Co Service xu ly",
        run: (doc) =>
          hasType(doc, "webService", "function")
            ? { passed: true, detail: "Da co service." }
            : { passed: false, detail: "Thieu Web Service / Function." },
      },
      checkNoSpof(),
      checkNoCycle(),
    ],
  },
  {
    slug: "realtime-feed",
    title: "Feed realtime",
    description: "Thiet ke feed realtime: hang doi / stream + cache + db.",
    passScore: 80,
    checks: [
      {
        id: "has-async",
        label: "Co Message Queue hoac Stream Processor",
        run: (doc) =>
          hasType(doc, "messageQueue", "streamProc")
            ? { passed: true, detail: "Da co thanh phan async." }
            : { passed: false, detail: "Thieu Message Queue / Stream Processor." },
      },
      {
        id: "has-cache",
        label: "Co Cache cho feed",
        run: (doc) =>
          hasType(doc, "cache")
            ? { passed: true, detail: "Da co cache." }
            : { passed: false, detail: "Thieu Cache cho feed." },
      },
      {
        id: "has-database",
        label: "Co Database",
        run: (doc) =>
          hasType(doc, "relationalDb", "nosqlDb")
            ? { passed: true, detail: "Da co database." }
            : { passed: false, detail: "Thieu database." },
      },
      checkClientConnected(),
      checkNoCycle(),
    ],
  },
];

export function listProblems(): Pick<QuizProblem, "slug" | "title" | "description">[] {
  return QUIZ_PROBLEMS.map(({ slug, title, description }) => ({
    slug,
    title,
    description,
  }));
}

export function gradeDesign(
  doc: CanvasDocument,
  problemSlug: string,
): QuizResult {
  const problem = QUIZ_PROBLEMS.find((p) => p.slug === problemSlug);
  if (!problem) {
    return {
      problemSlug,
      score: 0,
      passed: false,
      checks: [
        {
          label: "Bai tap khong ton tai",
          passed: false,
          detail: `Khong tim thay problem '${problemSlug}'.`,
        },
      ],
    };
  }
  const checks = problem.checks.map((c) => {
    const r = c.run(doc);
    return { label: c.label, passed: r.passed, detail: r.detail };
  });
  const passedCount = checks.filter((c) => c.passed).length;
  const score =
    checks.length === 0
      ? 100
      : Math.round((passedCount / checks.length) * 100);
  return {
    problemSlug,
    score,
    passed: score >= problem.passScore,
    checks,
  };
}
