"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import land from "./geo/land.json";
import rivers from "./geo/rivers.json";
import lakes from "./geo/lakes.json";

/**
 * No tile server, no API key, no live third-party dependency — the only
 * "map" data is the tiny bundled GeoJSON in ./geo (Natural Earth 1:50m land,
 * rivers, and lakes, clipped to this journey's region and simplified; public
 * domain). MapLibre here is purely a renderer/interaction engine over data
 * we ship ourselves, which is what keeps this fully static and offline like
 * the rest of the app. See DESIGN.md's Journeys section for why this
 * replaced an earlier raster-image approach.
 */
const PALETTE = {
  light: { water: "#a9cdd9", land: "#efe6d0", border: "#c2b28e", river: "#5f93ac" },
  dark: { water: "#122a3d", land: "#2a2620", border: "#463f31", river: "#3f6f89" },
} as const;

function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

// A small filled triangle, registered once as an SDF image so each
// character's arrow layer can tint it via icon-color instead of needing one
// icon per color. Plain solid alpha (not a true distance field) still
// renders as a crisp flat-color shape under sdf mode — fine at this size.
const ARROW_ICON_ID = "journey-arrow";
const ARROW_ICON_SIZE = 20;

function buildArrowIcon(): { width: number; height: number; data: Uint8ClampedArray } {
  const canvas = document.createElement("canvas");
  canvas.width = ARROW_ICON_SIZE;
  canvas.height = ARROW_ICON_SIZE;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(10, 1);
  ctx.lineTo(18, 18);
  ctx.lineTo(10, 13);
  ctx.lineTo(2, 18);
  ctx.closePath();
  ctx.fill();
  const { data } = ctx.getImageData(0, 0, ARROW_ICON_SIZE, ARROW_ICON_SIZE);
  return { width: ARROW_ICON_SIZE, height: ARROW_ICON_SIZE, data };
}

// One arrow at the midpoint of each consecutive stop-to-stop segment, rotated
// to face the direction of travel — not evenly spaced along the whole line,
// so there's exactly one per "between these two bubbles" as asked for,
// rather than a repeating pattern that ignores where the stops actually are.
function arrowPoints(coordinates: [number, number][]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lng1, lat1] = coordinates[i];
    const [lng2, lat2] = coordinates[i + 1];
    const midLat = (lat1 + lat2) / 2;
    // Longitude degrees shrink relative to latitude degrees away from the
    // equator — this correction keeps the bearing visually accurate instead
    // of skewing east-west segments at this region's latitude.
    const dx = (lng2 - lng1) * Math.cos((midLat * Math.PI) / 180);
    const dy = lat2 - lat1;
    const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
    features.push({
      type: "Feature",
      properties: { bearing },
      geometry: { type: "Point", coordinates: [(lng1 + lng2) / 2, midLat] },
    });
  }
  return { type: "FeatureCollection", features };
}

export interface JourneyMapStop {
  id: string;
  lat: number;
  lng: number;
  color: string;
  selected: boolean;
  dimmed: boolean;
  label: string;
}

export interface JourneyMapLine {
  characterId: string;
  color: string;
  coordinates: [number, number][];
  dimmed: boolean;
}

/** [[minLng, minLat], [maxLng, maxLat]] */
export type LngLatBounds = [[number, number], [number, number]];

function padBounds([[minLng, minLat], [maxLng, maxLat]]: LngLatBounds, factor: number): LngLatBounds {
  const padLng = Math.max((maxLng - minLng) * factor, 1.5);
  const padLat = Math.max((maxLat - minLat) * factor, 1.5);
  return [[minLng - padLng, minLat - padLat], [maxLng + padLng, maxLat + padLat]];
}

// A LineString with zero coordinates is invalid GeoJSON (it needs at least
// two positions) — an empty FeatureCollection is the well-formed way to say
// "nothing to draw yet" for a character with fewer than two stops so far.
const EMPTY_LINE: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export default function JourneyMap({
  stops,
  lines,
  bounds,
  onSelectStop,
}: {
  stops: JourneyMapStop[];
  lines: JourneyMapLine[];
  bounds: LngLatBounds;
  onSelectStop: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const readyRef = useRef(false);
  // First load spins up a Web Worker to parse the GeoJSON, which can
  // visibly take a couple of seconds — worth a loading state so that shows
  // as "loading," not as a blank pane that might read as broken.
  const [ready, setReady] = useState(false);
  const onSelectStopRef = useRef(onSelectStop);
  useEffect(() => {
    onSelectStopRef.current = onSelectStop;
  });

  // Map init — once. Region lock via maxBounds means users can zoom into a
  // cluster of stops but can't pan away from the story or zoom out to a
  // blank world.
  useEffect(() => {
    if (!containerRef.current) return;
    const markers = markersRef.current;
    const pal = PALETTE[currentTheme()];
    const lineLayers = lines.map((l) => ({
      id: `line-${l.characterId}`,
      type: "line" as const,
      source: `line-${l.characterId}`,
      paint: { "line-color": l.color, "line-width": 2, "line-opacity": 0.12 },
    }));

    // Turbopack doesn't emit maplibre-gl's worker as a working sibling asset
    // — its bundled worker fails on its own first import and the map's
    // style silently never finishes loading. The worker (and the shared
    // module it imports) are copied into public/maplibre verbatim from
    // node_modules instead, and pointed at explicitly here, so the worker
    // loads as a plain static file outside Turbopack's bundling of it.
    setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

    const map = new MapLibreMap({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          land: { type: "geojson", data: land as GeoJSON.FeatureCollection },
          rivers: { type: "geojson", data: rivers as GeoJSON.FeatureCollection },
          lakes: { type: "geojson", data: lakes as GeoJSON.FeatureCollection },
          ...Object.fromEntries(lines.map((l) => [`line-${l.characterId}`, { type: "geojson" as const, data: EMPTY_LINE }])),
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": pal.water } },
          { id: "land-fill", type: "fill", source: "land", paint: { "fill-color": pal.land } },
          { id: "land-outline", type: "line", source: "land", paint: { "line-color": pal.border, "line-width": 0.6 } },
          { id: "rivers-line", type: "line", source: "rivers", paint: { "line-color": pal.river, "line-width": 1.2 } },
          { id: "lakes-fill", type: "fill", source: "lakes", paint: { "fill-color": pal.water } },
          { id: "lakes-outline", type: "line", source: "lakes", paint: { "line-color": pal.river, "line-width": 0.6 } },
          ...lineLayers,
        ],
      },
      bounds,
      fitBoundsOptions: { padding: 24 },
      maxBounds: padBounds(bounds, 0.6),
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      readyRef.current = true;
      map.addImage(ARROW_ICON_ID, buildArrowIcon(), { sdf: true });
      for (const l of lines) {
        map.addSource(`arrows-${l.characterId}`, { type: "geojson", data: arrowPoints(l.coordinates) });
        map.addLayer({
          id: `arrows-${l.characterId}`,
          type: "symbol",
          source: `arrows-${l.characterId}`,
          layout: {
            "icon-image": ARROW_ICON_ID,
            "icon-rotate": ["get", "bearing"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": 0.5,
          },
          paint: { "icon-color": l.color, "icon-opacity": l.dimmed ? 0.12 : 0.75 },
        });
      }
      setReady(true);
    });
    map.on("error", (e) => { console.error("MAPLIBRE ERROR", e.error); });
    mapRef.current = map;

    // The container's real size isn't necessarily settled yet when the Map
    // constructor reads it — it's a flex child (`.journey-map-container`)
    // whose height depends on a layout pass this effect can run just ahead
    // of. Without this, the map's canvas can get stuck sized to whatever
    // (possibly zero-ish) box existed at construction time, so nothing
    // beyond that corner ever paints even after data loads. A ResizeObserver
    // also keeps it correct if the container resizes later (e.g. viewport
    // resize, sidebar content reflowing).
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markers.clear();
      readyRef.current = false;
      setReady(false);
    };
    // Sources/layers are declared once from the lines list's *shape* (which
    // characters exist) — re-running this whole effect on every dimmed/
    // selected change would tear down and rebuild the map for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-theme in place on the site's light/dark toggle, instead of forcing a
  // fixed look regardless of theme (possible now that this is a real vector
  // render, not a baked photo).
  useEffect(() => {
    const applyTheme = () => {
      const map = mapRef.current;
      // ThemeToggle sets data-theme again on its own mount (reading
      // localStorage), which can fire this observer before the map's style
      // has finished its own async load — calling setPaintProperty before
      // then throws "Style is not done loading", so this waits for 'load'
      // exactly like the lines effect does.
      if (!map) return;
      if (!readyRef.current) { map.once("load", applyTheme); return; }
      const pal = PALETTE[currentTheme()];
      map.setPaintProperty("bg", "background-color", pal.water);
      map.setPaintProperty("land-fill", "fill-color", pal.land);
      map.setPaintProperty("land-outline", "line-color", pal.border);
      map.setPaintProperty("rivers-line", "line-color", pal.river);
      map.setPaintProperty("lakes-fill", "fill-color", pal.water);
      map.setPaintProperty("lakes-outline", "line-color", pal.river);
      map.resize();
      map.triggerRepaint();
    };
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  // Per-character line geometry and dim state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      for (const l of lines) {
        const source = map.getSource(`line-${l.characterId}`) as GeoJSONSource | undefined;
        if (!source) continue;
        source.setData(
          l.coordinates.length >= 2
            ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: l.coordinates } }
            : EMPTY_LINE
        );
        if (map.getLayer(`line-${l.characterId}`)) {
          // Slightly more transparent than a solid line so the endpoint
          // bubbles (drawn on top as DOM markers) read as the clearly
          // brighter, more solid element instead of blending into the route.
          map.setPaintProperty(`line-${l.characterId}`, "line-opacity", l.dimmed ? 0.12 : 0.75);
          map.setPaintProperty(`line-${l.characterId}`, "line-width", l.dimmed ? 2 : 3);
        }
        if (map.getLayer(`arrows-${l.characterId}`)) {
          map.setPaintProperty(`arrows-${l.characterId}`, "icon-opacity", l.dimmed ? 0.12 : 0.75);
        }
      }
    };
    if (readyRef.current) apply();
    else map.once("load", apply);
  }, [lines]);

  // Stop markers — plain DOM elements so click/keyboard/aria work exactly
  // like any other button, and z-index (not paint order) puts the selected
  // one on top reliably.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();
    for (const stop of stops) {
      seen.add(stop.id);
      let marker = markersRef.current.get(stop.id);
      if (!marker) {
        const el = document.createElement("div");
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        el.style.borderRadius = "50%";
        el.style.cursor = "pointer";
        el.style.border = "1.5px solid #fff8ea";
        el.style.boxSizing = "border-box";
        el.addEventListener("click", () => onSelectStopRef.current(stop.id));
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectStopRef.current(stop.id); }
        });
        marker = new Marker({ element: el }).setLngLat([stop.lng, stop.lat]).addTo(map);
        markersRef.current.set(stop.id, marker);
      }
      const el = marker.getElement();
      el.setAttribute("aria-pressed", String(stop.selected));
      el.setAttribute("aria-label", stop.label);
      const size = stop.selected ? 18 : 12;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.background = stop.color;
      // A same-color line can run right through a dot and make "selected"
      // hard to tell from "just a stop on the route" — a white halo ring
      // reads clearly regardless of the line or terrain color underneath.
      el.style.boxShadow = stop.selected ? "0 0 0 3px rgba(255, 248, 234, 0.9), 0 1px 4px rgba(0, 0, 0, 0.45)" : "none";
      // Marker owns el.style.opacity itself — it rewrites it on every map
      // move via its own tracked _opacity (see setOpacity in maplibre-gl),
      // clobbering a direct el.style.opacity write the next time the map
      // pans or zooms. Going through setOpacity keeps our value authoritative.
      marker.setOpacity(stop.dimmed ? "0" : "1");
      el.style.pointerEvents = stop.dimmed ? "none" : "auto";
      el.style.zIndex = stop.selected ? "10" : "1";
    }

    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) { marker.remove(); markersRef.current.delete(id); }
    }
  }, [stops]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {!ready ? (
        <div
          style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--text-muted)", pointerEvents: "none",
          }}
        >
          Loading map…
        </div>
      ) : null}
    </div>
  );
}
