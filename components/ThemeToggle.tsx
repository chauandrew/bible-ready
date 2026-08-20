"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getStored(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem("bible-ready:theme");
  return v === "light" || v === "dark" ? v : null;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // One-time hydration from localStorage/matchMedia (unavailable during static-export SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(getStored() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("bible-ready:theme", theme);
  }, [theme]);

  if (!theme) return <span className="btn" style={{ visibility: "hidden" }} aria-hidden />;

  return (
    <button
      type="button"
      className="btn"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label="Toggle dark mode"
    >
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}
