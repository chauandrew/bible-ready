"use client";

/** Anonymous per-browser identity for QOTD (no accounts). Never throws. */

const STORAGE_KEY = "bible-ready:deviceId:v1";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID(); // won't persist, but load still works
  }
}
