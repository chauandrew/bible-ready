import Link from "next/link";

/** The "back to {book}" eyebrow link every /[book]/study/* index page starts with. */
export default function BookBreadcrumb({ bookId, bookName }: { bookId: string; bookName: string }) {
  return (
    <p className="eyebrow" style={{ marginTop: "1rem" }}>
      <Link href={`/${bookId}`} style={{ color: "inherit" }}>{bookName}</Link>
    </p>
  );
}
