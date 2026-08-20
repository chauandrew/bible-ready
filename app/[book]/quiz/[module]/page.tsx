import { Suspense } from "react";
import { notFound } from "next/navigation";
import { quizModuleIdsForBook, dataForModuleInBook, arcInBook, bookMeta, wiredBookIds } from "@/lib/content";
import QuizSetup from "@/components/QuizSetup";

export function generateStaticParams() {
  return wiredBookIds.flatMap((book) => quizModuleIdsForBook(book).map((module) => ({ book, module })));
}

export default async function QuizModulePage({ params }: { params: Promise<{ book: string; module: string }> }) {
  const { book: bookId, module } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();
  const resolved = dataForModuleInBook(bookId, module);
  if (!resolved) notFound();

  const label = module === "all" ? `Quiz — ${book.name}` : `Quiz — ${arcInBook(bookId, module)?.name ?? module}`;

  return (
    <Suspense>
      <QuizSetup
        moduleId={module}
        moduleLabel={label}
        data={resolved.data}
        questions={resolved.questions}
        backHref={`/${bookId}`}
        backLabel={`Back to ${book.name}`}
      />
    </Suspense>
  );
}
