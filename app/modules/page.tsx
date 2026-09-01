import Link from "next/link";
import { available } from "../page";

export default function AllModules() {
  return (
    <main className="container-wide">
      <p className="eyebrow" style={{ marginTop: "1rem" }}>
        <Link href="/" style={{ color: "inherit" }}>Bible Ready</Link>
      </p>
      <h1 className="page-title" style={{ margin: "0 0 1.25rem" }}>All Modules</h1>
      <div className="grid-cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 360px))" }}>
        {available.map((b) => (
          <Link key={b.href} href={b.href} className="card">
            <div style={{ fontWeight: 600, color: "var(--text)" }}>{b.name}</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              {b.desc}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
