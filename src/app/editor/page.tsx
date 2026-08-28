import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import EditorClient from "@/components/canvas/EditorClient";

export const dynamic = "force-dynamic";

export default async function NewEditorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <EditorClient designId={null} initialDoc={null} />;
}
