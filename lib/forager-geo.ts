"use client";

import { useEffect, useState } from "react";

export type LatLng = { lat: number; lng: number };

const SESSION_KEY = "forager:lastGeo";
const TTL_MS = 10 * 60 * 1000;

/** Returns the user's lat/lng once geolocation succeeds, or null until then.
 * Caches the most recent fix in sessionStorage so navigations don't re-prompt. */
export function useUserGeo(): LatLng | null {
  const [geo, setGeo] = useState<LatLng | null>(() => readCached());

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    if (geo && Date.now() - readCachedAt() < TTL_MS) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const value: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGeo(value);
        writeCached(value);
      },
      () => {
        // Permission denied or error; leave geo as null.
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 }
    );
  }, [geo]);

  return geo;
}

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.7613; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistanceMi(miles: number): string {
  if (!Number.isFinite(miles)) return "—";
  if (miles < 0.1) return "<0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

function readCached(): LatLng | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value: LatLng; ts: number };
    if (Date.now() - parsed.ts > TTL_MS) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function readCachedAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return 0;
    return (JSON.parse(raw) as { ts: number }).ts ?? 0;
  } catch {
    return 0;
  }
}

function writeCached(value: LatLng) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ value, ts: Date.now() })
    );
  } catch {
    /* ignore */
  }
}
