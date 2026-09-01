"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import land from "./geo/land.json";
import rivers from "./geo/rivers.json";
import lakes from "./geo/lakes.json";
import places from "./geo/places.json";
import regions from "./geo/regions.json";

/**
 * No tile server, no API key, no live third-party dependency — the only
 * "map" data is the tiny bundled GeoJSON in ./geo (Natural Earth 1:50m land,
 * rivers, and lakes, clipped to this journey's region and simplified; public
 * domain) plus ./geo/places.json (a small hand-authored, book-agnostic list
 * of reference cities/seas/rivers/neighboring-region labels — see
 * `placesGeoJSON` below) and ./geo/regions.json (a rough territory outline
 * per era — see `regionsGeoJSON`). MapLibre here is purely a renderer/interaction
 * engine over data we ship ourselves, which is what keeps this fully static
 * and offline like the rest of the app. See DESIGN.md's Journeys section for
 * why this replaced an earlier raster-image approach.
 */
const PALETTE = {
  light: {
    water: "#a9cdd9", land: "#efe6d0", border: "#c2b28e", river: "#5f93ac", label: "#6b6252", waterLabel: "#3c6e8f",
    regionLabel: "#a1483f", kingdomFill: "#c9a227", kingdomOutline: "#8a6d1f",
  },
  dark: {
    water: "#122a3d", land: "#2a2620", border: "#463f31", river: "#3f6f89", label: "#a89f8c", waterLabel: "#7fa8c2",
    regionLabel: "#d98f86", kingdomFill: "#d9b64f", kingdomOutline: "#e0c876",
  },
} as const;

/**
 * Overrides the auto-fit-to-stops default for an era whose story happens in
 * a tight geographic cluster (1-2 Samuel's Saul/David years, mostly within
 * a day's walk of Jerusalem) but whose readers need the wider "kingdom and
 * its neighbors" context to orient themselves — roughly Sidon/Damascus in
 * the north to Kadesh-barnea in the south, the Mediterranean to Ammon.
 * Absent here, an era just falls back to fitting the journey's own stops
 * (Genesis's patriarchs already span Haran to Egypt, so that default is
 * already the right "zoomed out" view — no override needed; the "return"
 * era's Babylon-to-Jerusalem journeys are wider still, so no override there
 * either).
 *
 * `"gospels"` gets the same treatment: Matthew's ministry stops cluster
 * tightly around Galilee and Jerusalem, but the place/region labels (Tyre,
 * Sidon, the Decapolis, Perea, Samaria) exist to show the wider region Jesus
 * moves through — roughly a standard Bible-atlas "ministry of Jesus" map,
 * Tyre and Sidon in the north to the Dead Sea in the south, the
 * Mediterranean coast to the Decapolis and Perea across the Jordan.
 */
const ERA_BOUNDS: Record<string, LngLatBounds> = {
  "united-kingdom": [[33.9, 30.4], [36.4, 33.7]],
  gospels: [[33.0, 30.9], [36.0, 33.6]],
};

function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "city" | "water" | "region";
  eras: string[];
}

function placesGeoJSON(kind: Place["kind"], era: string): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = (places as Place[])
    .filter((p) => p.kind === kind && p.eras.includes(era))
    .map((p) => ({
      type: "Feature",
      properties: { name: p.name },
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    }));
  return { type: "FeatureCollection", features };
}

interface Region {
  id: string;
  name: string;
  era: string;
  ring: number[][];
}

/** A rough territory outline (see ./geo/regions.json) for the era's home
 * kingdom — a single polygon per era at most, not the neighboring peoples
 * (those stay simple point labels via `placesGeoJSON("region", era)`). */
function regionsGeoJSON(era: string): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = (regions as Region[])
    .filter((r) => r.era === era)
    .map((r) => ({
      type: "Feature",
      properties: { name: r.name },
      geometry: { type: "Polygon", coordinates: [r.ring] },
    }));
  return { type: "FeatureCollection", features };
}

export interface JourneyMapStop {
  id: string;
  lat: number;
  lng: number;
  color: string;
  selected: boolean;
  label: string;
}

/** [[minLng, minLat], [maxLng, maxLat]] */
export type LngLatBounds = [[number, number], [number, number]];

function padBounds([[minLng, minLat], [maxLng, maxLat]]: LngLatBounds, factor: number): LngLatBounds {
  const padLng = Math.max((maxLng - minLng) * factor, 1.5);
  const padLat = Math.max((maxLat - minLat) * factor, 1.5);
  return [[minLng - padLng, minLat - padLat], [maxLng + padLng, maxLat + padLat]];
}

export default function JourneyMap({
  stops,
  era,
  bounds,
  onSelectStop,
}: {
  stops: JourneyMapStop[];
  /** Which of `components/maps/geo/places.json`'s eras to show background
   * city/water labels for — see `Journey.era` in content/schema.ts. */
  era: string;
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
    const effectiveBounds = ERA_BOUNDS[era] ?? bounds;

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
          "places-water": { type: "geojson", data: placesGeoJSON("water", era) },
          "places-city": { type: "geojson", data: placesGeoJSON("city", era) },
          "places-region": { type: "geojson", data: placesGeoJSON("region", era) },
          kingdom: { type: "geojson", data: regionsGeoJSON(era) },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": pal.water } },
          { id: "land-fill", type: "fill", source: "land", paint: { "fill-color": pal.land } },
          { id: "land-outline", type: "line", source: "land", paint: { "line-color": pal.border, "line-width": 0.6 } },
          { id: "rivers-line", type: "line", source: "rivers", paint: { "line-color": pal.river, "line-width": 1.2 } },
          { id: "lakes-fill", type: "fill", source: "lakes", paint: { "fill-color": pal.water } },
          { id: "lakes-outline", type: "line", source: "lakes", paint: { "line-color": pal.river, "line-width": 0.6 } },
          // A rough territory tint for the era's home kingdom (see
          // ./geo/regions.json's own `note` field for what this is and
          // isn't) — a translucent fill plus a dashed outline, distinct
          // from the water-blue palette so it doesn't read as a sea.
          { id: "kingdom-fill", type: "fill", source: "kingdom", paint: { "fill-color": pal.kingdomFill, "fill-opacity": 0.16 } },
          { id: "kingdom-outline", type: "line", source: "kingdom", paint: { "line-color": pal.kingdomOutline, "line-width": 1.4, "line-dasharray": [2, 2] } },
          // Background orientation labels — major cities, physical
          // geography (seas, rivers), and neighboring peoples/regions
          // relevant to this journey's era, from the shared reference list.
          // Purely informational: no icon, no click handler, so they never
          // compete with the interactive stop markers drawn on top as DOM
          // elements.
          {
            id: "places-region-label",
            type: "symbol",
            source: "places-region",
            layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Italic"], "text-size": 13, "text-letter-spacing": 0.05 },
            paint: { "text-color": pal.regionLabel, "text-halo-color": pal.land, "text-halo-width": 1 },
          },
          {
            id: "places-water-label",
            type: "symbol",
            source: "places-water",
            layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Italic"], "text-size": 11, "text-anchor": "center" },
            paint: { "text-color": pal.waterLabel, "text-halo-color": pal.water, "text-halo-width": 1.2 },
          },
          {
            id: "places-city-label",
            type: "symbol",
            source: "places-city",
            layout: {
              "text-field": ["get", "name"],
              "text-font": ["Noto Sans Regular"],
              "text-size": 10.5,
              "text-anchor": "left",
              "text-offset": [0.5, 0],
            },
            paint: { "text-color": pal.label, "text-halo-color": pal.land, "text-halo-width": 1.2 },
          },
          {
            id: "places-city-dot",
            type: "circle",
            source: "places-city",
            paint: { "circle-radius": 2, "circle-color": pal.label },
          },
        ],
      },
      bounds: effectiveBounds,
      fitBoundsOptions: { padding: 24 },
      maxBounds: padBounds(effectiveBounds, 0.6),
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      readyRef.current = true;
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
    // Sources/layers are declared once from `era` (fixed for the life of this
    // page) — re-running this whole effect on every dimmed/selected change
    // would tear down and rebuild the map for no reason.
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
      // before touching any paint property.
      if (!map) return;
      if (!readyRef.current) { map.once("load", applyTheme); return; }
      const pal = PALETTE[currentTheme()];
      map.setPaintProperty("bg", "background-color", pal.water);
      map.setPaintProperty("land-fill", "fill-color", pal.land);
      map.setPaintProperty("land-outline", "line-color", pal.border);
      map.setPaintProperty("rivers-line", "line-color", pal.river);
      map.setPaintProperty("lakes-fill", "fill-color", pal.water);
      map.setPaintProperty("lakes-outline", "line-color", pal.river);
      map.setPaintProperty("kingdom-fill", "fill-color", pal.kingdomFill);
      map.setPaintProperty("kingdom-outline", "line-color", pal.kingdomOutline);
      map.setPaintProperty("places-region-label", "text-color", pal.regionLabel);
      map.setPaintProperty("places-region-label", "text-halo-color", pal.land);
      map.setPaintProperty("places-water-label", "text-color", pal.waterLabel);
      map.setPaintProperty("places-water-label", "text-halo-color", pal.water);
      map.setPaintProperty("places-city-label", "text-color", pal.label);
      map.setPaintProperty("places-city-label", "text-halo-color", pal.land);
      map.setPaintProperty("places-city-dot", "circle-color", pal.label);
      map.resize();
      map.triggerRepaint();
    };
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

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
      // Every stop stays visible and clickable all the time — with the
      // per-character lines gone, a dense journey (three overlapping paths
      // in 1 Samuel) reads better as "all the dots, softened" than as
      // "most of the dots hidden." The unselected majority is just faded a
      // little (not grayscale) so the current stop still pops.
      // Marker owns el.style.opacity itself — it rewrites it on every map
      // move via its own tracked _opacity (see setOpacity in maplibre-gl),
      // clobbering a direct el.style.opacity write the next time the map
      // pans or zooms. Going through setOpacity keeps our value authoritative.
      marker.setOpacity(stop.selected ? "1" : "0.55");
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
