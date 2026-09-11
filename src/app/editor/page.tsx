import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import EditorClient from "@/components/canvas/EditorClient";
import type { CanvasDocument } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMPTY_DOCUMENT: CanvasDocument = {
  nodes: [],
  edges: [],
  meta: { name: "Untitled design" },
};

export default async function NewEditorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <EditorClient designId={null} initialDoc={EMPTY_DOCUMENT} />;
}
