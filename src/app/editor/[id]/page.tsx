import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { designs } from "@/db/schema";
import { eq } from "drizzle-orm";
import EditorClient from "@/components/canvas/EditorClient";
import type { CanvasDocument } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function EditEditorPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const [design] = await db
    .select()
    .from(designs)
    .where(eq(designs.id, id))
    .limit(1);

  if (!design || design.userId !== session.user.id) redirect("/");

  const canvasData = (design.canvasData ?? {
    nodes: [],
    edges: [],
    meta: { name: design.title },
  }) as CanvasDocument;

  return (
    <EditorClient
      designId={design.id}
      initialVersion={design.version}
      initialIsPublic={design.isPublic}
      initialDoc={{
        nodes: canvasData.nodes ?? [],
        edges: canvasData.edges ?? [],
        meta: { name: design.title },
      }}
    />
  );
}
