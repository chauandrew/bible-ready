"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadProgress, clearAllProgress, type ProgressState } from "@/lib/progress";

export default function ProgressPage() {
  const [state, setState] = useState<ProgressState | null>(null);

  useEffect(() => {
    // One-time hydration from localStorage (unavailable during static-export SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadProgress());
  }, []);

  if (!state) return null;

  const categories = Object.entries(state.categoryStats).sort((a, b) => {
    const pa = a[1].right / (a[1].right + a[1].wrong);
    const pb = b[1].right / (b[1].right + b[1].wrong);
    return pa - pb;
  });

  return (
    <main className="container">
      <h1 style={{ fontSize: "1.4rem", margin: "1rem 0 1rem" }}>Your progress</h1>

      {state.sessions.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>No quizzes taken yet.</p>
      ) : (
        <>
          <p className="eyebrow">Recent sessions</p>
          <div style={{ display: "grid", gap: "0.4rem", margin: "0.5rem 0 1.5rem" }}>
            {state.sessions.slice(-8).reverse().map((s, i) => (
              <div key={i} className="card" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{s.moduleId}</span>
                <span className="citation">{s.correct}/{s.total} ({s.percent}%)</span>
              </div>
            ))}
          </div>

          {categories.length > 0 && (
            <>
              <p className="eyebrow">By category</p>
              <div style={{ display: "grid", gap: "0.4rem", margin: "0.5rem 0 1.5rem" }}>
                {categories.map(([cat, r]) => (
                  <div key={cat} className="card" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{cat}</span>
                    <span className="citation">{r.right}/{r.right + r.wrong}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {state.missed.length > 0 && (
            <Link href="/practice" className="btn btn-primary" style={{ marginBottom: "1rem" }}>
              Practice your misses ({state.missed.length})
            </Link>
          )}
        </>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <button type="button" className="btn" onClick={() => { clearAllProgress(); setState(loadProgress()); }}>
          Clear progress
        </button>
      </div>
    </main>
  );
}
