import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { designs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { simulateDesign } from "@/lib/engine/simulation";
import type { CanvasDocument } from "@/lib/types";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { designId?: string; inputRps?: number; failureNodeId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.designId) {
    return NextResponse.json({ error: "designId required" }, { status: 400 });
  }

  const inputRps =
    typeof body.inputRps === "number" && Number.isFinite(body.inputRps) && body.inputRps > 0
      ? Math.min(body.inputRps, 10_000_000)
      : 1000;

  const [design] = await db
    .select({ canvasData: designs.canvasData })
    .from(designs)
    .where(
      and(eq(designs.id, body.designId), eq(designs.userId, session.user.id)),
    )
    .limit(1);

  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  const raw = design.canvasData as unknown as CanvasDocument | null;
  const doc: CanvasDocument = {
    nodes: raw?.nodes ?? [],
    edges: raw?.edges ?? [],
    meta: raw?.meta ?? { name: "" },
  };

  const result = simulateDesign(doc, inputRps, body.failureNodeId);
  return NextResponse.json(result);
}
