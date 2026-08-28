import { notFound } from "next/navigation";
import { bookMeta, chaptersForBook, wiredBookIds } from "@/lib/content";
import ChapterOrderBoard from "@/components/ChapterOrderBoard";

export function generateStaticParams() {
  return wiredBookIds
    .filter((id) => bookMeta(id)?.coverageDepth !== "selection")
    .map((book) => ({ book }));
}

export default async function ChapterOrderPage({ params }: { params: Promise<{ book: string }> }) {
  const { book: bookId } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId) || book.coverageDepth === "selection") notFound();

  return (
    <ChapterOrderBoard
      bookId={bookId}
      bookName={book.name}
      chapterLabel={book.chapterLabel}
      chapters={chaptersForBook(bookId)}
      backHref={`/${bookId}`}
    />
  );
}
