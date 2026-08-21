import Link from "next/link";
import { notFound } from "next/navigation";
import { peopleForBook, wiredBookIds, bookMeta } from "@/lib/content";
import BookBreadcrumb from "@/components/BookBreadcrumb";

export function generateStaticParams() {
  return wiredBookIds.map((book) => ({ book }));
}

export default async function PeopleIndex({ params }: { params: Promise<{ book: string }> }) {
  const { book: bookId } = await params;
  const book = bookMeta(bookId);
  if (!book || !wiredBookIds.includes(bookId)) notFound();
  const people = peopleForBook(bookId);

  return (
    <main className="container-wide">
      <BookBreadcrumb bookId={bookId} bookName={book.name} />
      <h1 className="page-title" style={{ margin: "0 0 1.25rem" }}>People</h1>
      <div className="grid-cards">
        {people.map((p) => (
          <Link key={p.id} href={`/${bookId}/study/people/${p.id}`} className="card">
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
              {p.summary}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
