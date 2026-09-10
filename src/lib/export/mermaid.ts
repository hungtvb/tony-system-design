/**
 * Mermaid exporter for a system-design canvas.
 *
 * Converts a CanvasDocument into a Mermaid `flowchart LR` string that can be
 * pasted into mermaid.live, GitHub markdown, Notion, etc.
 *
 * Node ids are sanitized (mermaid ids must be alphanumeric/underscore).
 * Labels are quoted. Each node gets a class by category; a classDef block
 * maps categories to the block colors from the catalog.
 */

import type { CanvasDocument } from "@/lib/types";
import { BLOCK_CATALOG } from "@/lib/catalog";

function sanitizeId(id: string): string {
  const s = id.replace(/[^a-zA-Z0-9_]/g, "_");
  return /^[0-9]/.test(s) ? `n_${s}` : s || "node";
}

function escapeLabel(label: string): string {
  return label.replace(/["#<>`]/g, "").trim().slice(0, 60) || "Node";
}

export function toMermaid(doc: CanvasDocument): string {
  const lines: string[] = ["flowchart LR"];
  const idMap = new Map<string, string>();
  const used = new Set<string>();

  for (const n of doc.nodes) {
    let sid = sanitizeId(n.id);
    let i = 1;
    while (used.has(sid)) sid = `${sanitizeId(n.id)}_${i++}`;
    used.add(sid);
    idMap.set(n.id, sid);
    const profile = BLOCK_CATALOG[n.type];
    lines.push(`    ${sid}["${escapeLabel(n.label)}"]:::${profile.category}`);
  }

  for (const e of doc.edges) {
    const s = idMap.get(e.source);
    const t = idMap.get(e.target);
    if (!s || !t) continue;
    lines.push(`    ${s} --> ${t}`);
  }

  // classDef per category (needs at least one node of that category to matter,
  // but harmless to emit all six)
  const seen = new Set<string>();
  for (const n of doc.nodes) seen.add(BLOCK_CATALOG[n.type].category);
  if (seen.size > 0) {
    lines.push("");
    const colorByCat: Record<string, string> = {};
    for (const n of doc.nodes) {
      const p = BLOCK_CATALOG[n.type];
      colorByCat[p.category] = p.color;
    }
    for (const [cat, color] of Object.entries(colorByCat)) {
      lines.push(`    classDef ${cat} fill:${color}22,stroke:${color},stroke-width:2px,color:#e6edf3`);
    }
  }

  if (doc.meta.name) {
    lines.unshift(`%% ${doc.meta.name}`);
  }

  return lines.join("\n") + "\n";
}
