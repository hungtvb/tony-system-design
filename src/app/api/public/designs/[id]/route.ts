import { NextResponse } from "next/server";
import { getPublicDesign } from "@/lib/designs";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Public read for shared designs (Issue #7). No auth required.
 * Private or missing ids → 404 without distinguishing them.
 * Only the public projection is exposed (no userId).
 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const design = await getPublicDesign(id);
  if (!design) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ design });
}
