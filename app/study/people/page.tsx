import Link from "next/link";
import { people } from "@/lib/content";

export default function PeopleIndex() {
  return (
    <main className="container-wide">
      <h1 className="page-title" style={{ margin: "1rem 0 1.25rem" }}>People</h1>
      <div className="grid-cards">
        {people.map((p) => (
          <Link key={p.id} href={`/study/people/${p.id}`} className="card">
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
