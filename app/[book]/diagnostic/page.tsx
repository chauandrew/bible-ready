import { notFound } from "next/navigation";
import { dataForModuleInBook, bookMeta, wiredBookIds } from "@/lib/content";
import DiagnosticClient from "@/components/DiagnosticClient";

export function generateStaticParams() {
  return wiredBookIds.map((book) => ({ book }));
}

export default async function DiagnosticPage({ params }: { params: Promise<{ book: string }> }) {
  const { book: bookId } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();
  const resolved = dataForModuleInBook(bookId, "all")!;
  return (
    <DiagnosticClient
      sources={[resolved]}
      backHref={`/${bookId}`}
      backLabel={`Back to ${book.name}`}
      chaptersHref={`/${bookId}/study/chapters`}
    />
  );
}
