import { notFound } from "next/navigation";
import { quizModuleIds, dataForModule, arcById, genesis } from "@/lib/content";
import PrintSheet from "@/components/PrintSheet";

export function generateStaticParams() {
  return quizModuleIds.map((module) => ({ module }));
}

export default async function PrintModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const resolved = dataForModule(module);
  if (!resolved) notFound();
  const label = module === "all" ? genesis.name : arcById.get(module)?.name ?? module;
  return <PrintSheet moduleLabel={label} data={resolved.data} questions={resolved.questions} />;
}
