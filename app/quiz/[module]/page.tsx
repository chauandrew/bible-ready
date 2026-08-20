import { notFound } from "next/navigation";
import { quizModuleIds, dataForModule, arcById, genesis } from "@/lib/content";
import QuizSetup from "@/components/QuizSetup";

export function generateStaticParams() {
  return quizModuleIds.map((module) => ({ module }));
}

export default async function QuizModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const resolved = dataForModule(module);
  if (!resolved) notFound();

  const label = module === "all" ? `Quiz — ${genesis.name}` : `Quiz — ${arcById.get(module)?.name ?? module}`;

  return <QuizSetup moduleId={module} moduleLabel={label} data={resolved.data} questions={resolved.questions} />;
}
