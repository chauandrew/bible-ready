"use client";

import { useState } from "react";
import Link from "next/link";
import { search, type SearchEntry } from "@/lib/content";

const TYPE_LABEL: Record<SearchEntry["type"], string> = {
  chapter: "Chapter",
  person: "Person",
  arc: "Arc",
};

export default function SearchPage() {
  const [q, setQ] = useState("");
  const results = search(q);

  return (
    <main className="container">
      <h1 style={{ fontSize: "1.4rem", margin: "1rem 0 0.75rem" }}>Search</h1>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Try “Abraham and Isaac” or “ark”"
        style={{
          width: "100%",
          minHeight: "44px",
          padding: "0 0.85rem",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--text)",
          fontFamily: "var(--font-sans)",
          fontSize: "0.95rem",
          marginBottom: "1rem",
        }}
      />
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {results.map((r) => (
          <Link key={`${r.type}:${r.id}`} href={r.href} className="card" style={{ display: "flex", justifyContent: "space-between", textDecoration: "none" }}>
            <span>{r.label}</span>
            <span className="badge">{TYPE_LABEL[r.type]}</span>
          </Link>
        ))}
        {q.trim() && results.length === 0 && (
          <p style={{ color: "var(--text-secondary)" }}>No matches for &ldquo;{q}&rdquo;.</p>
        )}
      </div>
    </main>
  );
}
