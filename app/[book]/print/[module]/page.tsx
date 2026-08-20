import { notFound } from "next/navigation";
import { printModuleIdsForBook, dataForModuleInBook, arcInBook, bookMeta, wiredBookIds } from "@/lib/content";
import PrintSheet from "@/components/PrintSheet";

export function generateStaticParams() {
  return wiredBookIds.flatMap((book) => printModuleIdsForBook(book).map((module) => ({ book, module })));
}

export default async function PrintModulePage({ params }: { params: Promise<{ book: string; module: string }> }) {
  const { book: bookId, module } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();
  const resolved = dataForModuleInBook(bookId, module);
  if (!resolved) notFound();
  const label = module === "all" ? book.name : arcInBook(bookId, module)?.name ?? module;
  return <PrintSheet moduleLabel={label} data={resolved.data} questions={resolved.questions} />;
}
