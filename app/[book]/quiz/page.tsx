import { Suspense } from "react";
import { notFound } from "next/navigation";
import { arcsForBook, bookMeta, wiredBookIds } from "@/lib/content";
import QuizSetup from "@/components/QuizSetup";

export function generateStaticParams() {
  return wiredBookIds.map((book) => ({ book }));
}

export default async function BookQuizPage({ params }: { params: Promise<{ book: string }> }) {
  const { book: bookId } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();

  return (
    <Suspense>
      <QuizSetup
        bookId={bookId}
        bookName={book.name}
        arcs={arcsForBook(bookId)}
        backHref={`/${bookId}`}
        backLabel={`Back to ${book.name}`}
        chaptersHref={`/${bookId}/study/chapters`}
        chapterLabel={book.chapterLabel}
      />
    </Suspense>
  );
}
