import Link from "next/link";
import { people } from "@/lib/content";

export default function PeopleIndex() {
  return (
    <main className="container">
      <h1 style={{ fontSize: "1.4rem", margin: "1rem 0" }}>People</h1>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {people.map((p) => (
          <Link key={p.id} href={`/study/people/${p.id}`} className="card" style={{ display: "block", textDecoration: "none" }}>
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
