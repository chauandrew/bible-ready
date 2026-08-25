"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import JourneyMap, { type JourneyMapStop, type LngLatBounds } from "@/components/maps/JourneyMap";

export interface JourneyStopView {
  id: string;
  order: number;
  place: string;
  lat: number;
  lng: number;
  locationNote?: string;
  characterIds: string[];
  eventName: string;
  eventSummary: string;
  citation: string;
}

export interface JourneyCharacterView {
  id: string;
  name: string;
  color: string;
}

export default function JourneyExplorer({
  bookId,
  bookName,
  era,
  journeyName,
  journeySummary,
  characters,
  stops,
}: {
  bookId: string;
  bookName: string;
  era: string;
  journeyName: string;
  journeySummary: string;
  characters: JourneyCharacterView[];
  stops: JourneyStopView[];
}) {
  const sorted = useMemo(() => [...stops].sort((a, b) => a.order - b.order), [stops]);
  const [selectedId, setSelectedId] = useState(sorted[0]?.id);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);

  const selected = sorted.find((s) => s.id === selectedId) ?? sorted[0];

  // When a character is focused, Prev/Next step through only *their* stops —
  // otherwise the "current" stop could wander onto another character's event
  // while that character's chip still shows as the active filter, which used
  // to leave the detail card showing an event whose own dot was dimmed out.
  const navigable = activeCharacterId
    ? sorted.filter((s) => s.characterIds.includes(activeCharacterId))
    : sorted;

  function goTo(delta: number) {
    if (navigable.length === 0) return;
    const currentIndex = navigable.findIndex((s) => s.id === selectedId);
    const base = currentIndex === -1 ? 0 : currentIndex;
    const wrapped = (base + delta + navigable.length) % navigable.length;
    setSelectedId(navigable[wrapped].id);
  }

  function focusCharacter(id: string) {
    // Clicking the chip that's already active (whether pinned manually or
    // just following the current stop) clears the pin and falls back to
    // auto-following again, rather than always pinning to `id`.
    setActiveCharacterId((current) => ((current ?? selected?.characterIds[0]) === id ? null : id));
    const firstStop = sorted.find((s) => s.characterIds.includes(id));
    if (firstStop) setSelectedId(firstStop.id);
  }

  // Selection can change via keyboard, a character chip, or Next/Prev — none
  // of which guarantee the sidebar has scrolled to show it, since the list
  // has its own independent scroll region.
  const selectedListItemRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedListItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(-1); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeCharacterId, sorted]);

  const characterById = new Map(characters.map((c) => [c.id, c]));
  // A chip click pins the filter explicitly. Absent that, the filter follows
  // whichever character owns the currently selected stop, so walking through
  // stops (Prev/Next, the list, or arrow keys) auto-highlights that person's
  // path without an extra click — a joint stop (both characters present)
  // just picks its first-listed character as the one to highlight.
  const effectiveCharacterId = activeCharacterId ?? selected?.characterIds[0] ?? null;
  // Only the effective character's path/dots stay visible; everyone else's
  // dots are hidden outright, not just faded, so the current person's route
  // reads clearly. The selected stop itself is never hidden, even if it
  // belongs to someone else, so navigating to it never hides its own dot.
  const stopDimmed = (stop: JourneyStopView) => {
    if (stop.id === selected?.id) return false;
    return effectiveCharacterId !== null && !stop.characterIds.includes(effectiveCharacterId);
  };
  const mapStops: JourneyMapStop[] = sorted.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    color: characterById.get(s.characterIds[0])?.color ?? "#888",
    selected: s.id === selected?.id,
    dimmed: stopDimmed(s),
    label: `${s.order}. ${s.eventName}, ${s.place}`,
  }));

  const bounds: LngLatBounds = useMemo(() => {
    const lats = stops.map((s) => s.lat);
    const lngs = stops.map((s) => s.lng);
    return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
  }, [stops]);

  return (
    <main className="container-wide" style={{ paddingBottom: "0.75rem" }}>
      <p className="eyebrow" style={{ marginTop: "0.5rem", marginBottom: "0.15rem" }}>
        <Link href={`/${bookId}`} style={{ color: "inherit" }}>{bookName}</Link> · Story map
      </p>
      <h1 className="page-title" style={{ marginTop: 0, marginBottom: "0.2rem", fontSize: "1.6rem" }}>{journeyName}</h1>
      <p className="page-lede" style={{ marginBottom: "0.75rem", fontSize: "0.85rem" }}>{journeySummary}</p>

      <div className="journey-row">
        {/* Left column: jump to a character, see the current event, jump to any stop */}
        <div className="journey-sidebar">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem", flexShrink: 0 }}>
            {characters.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => focusCharacter(c.id)}
                aria-pressed={effectiveCharacterId === c.id}
                style={{
                  display: "flex", alignItems: "center", gap: "0.35rem",
                  padding: "0.3rem 0.6rem", borderRadius: "999px",
                  border: `1.5px solid ${c.color}`,
                  background: effectiveCharacterId === c.id ? c.color : "transparent",
                  color: effectiveCharacterId === c.id ? "#fff" : "var(--text)",
                  fontFamily: "var(--font-sans)", fontSize: "0.85rem", cursor: "pointer",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: effectiveCharacterId === c.id ? "#fff" : c.color, display: "inline-block" }} />
                {c.name}
              </button>
            ))}
          </div>

          {selected ? (
            <div className="card" style={{ marginBottom: "0.75rem", flexShrink: 0 }}>
              <p className="eyebrow" style={{ marginTop: 0 }}>{selected.place} · {selected.citation}</p>
              <div style={{ fontWeight: 600, fontSize: "1rem", marginBottom: "0.3rem" }}>{selected.eventName}</div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-secondary)" }}>{selected.eventSummary}</p>
              {selected.locationNote ? (
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", marginTop: "0.3rem" }}>
                  {selected.locationNote}
                </p>
              ) : null}
              <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
                {selected.characterIds.map((cid) => {
                  const c = characterById.get(cid);
                  if (!c) return null;
                  return (
                    <span key={cid} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, display: "inline-block" }} />
                      {c.name}
                    </span>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem" }}>
                <button type="button" className="btn" onClick={() => goTo(-1)}>← Prev</button>
                <button type="button" className="btn btn-primary" onClick={() => goTo(1)}>Next →</button>
              </div>
            </div>
          ) : null}

          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1, minHeight: 0, overflowY: "auto" }}>
            {sorted.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  ref={s.id === selected?.id ? selectedListItemRef : undefined}
                  onClick={() => setSelectedId(s.id)}
                  aria-current={s.id === selected?.id}
                  style={{
                    width: "100%", textAlign: "left", padding: "0.4rem 0.6rem",
                    borderRadius: "8px", border: "1px solid var(--border)",
                    background: s.id === selected?.id ? "var(--surface-2)" : "transparent",
                    color: "var(--text)",
                    fontFamily: "var(--font-sans)", fontSize: "0.85rem", cursor: "pointer",
                  }}
                >
                  <div><strong>{s.order}.</strong> {s.eventName}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>{s.citation} · {s.place}</div>
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* Map */}
        <div className="journey-map-col">
          <div className="journey-map-container" aria-label={`Map of ${journeyName}`}>
            <JourneyMap stops={mapStops} era={era} bounds={bounds} onSelectStop={setSelectedId} />
          </div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.2rem", flexShrink: 0 }}>
            Journey stops researched individually — see each stop for notes where a site&apos;s identification is uncertain.
          </p>
        </div>
      </div>
    </main>
  );
}
