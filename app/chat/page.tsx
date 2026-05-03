"use client";

import { useState } from "react";

type Location = {
  latitude: number;
  longitude: number;
};

type EstimatedMacros = {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  confidence: "high" | "medium" | "low";
};

type Recommendation = {
  place: string;
  order: string;
  estimated_macros: EstimatedMacros;
  why: string;
  distance_miles?: number | null;
  price_level?: string | null;
  rating?: number | null;
  user_rating_count?: number | null;
  open_now?: boolean | null;
  google_maps_uri?: string | null;
  suggested_modifications?: string[];
  allergen_warnings?: string[];
};

type ChatResponse = {
  answer: string;
  tools_used: string[];
  recommendations: Recommendation[];
};

function getBrowserLocation(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => reject(new Error(err.message || "Failed to get location.")),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  });
}

export default function ChatPage() {
  const [message, setMessage] = useState(
    "cheap high-protein food near me under 800 calories"
  );
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);

  async function sendMessage() {
    setLoading(true);
    setAnswer("");
    setError("");
    setRecommendations([]);
    setToolsUsed([]);

    let location: Location;
    try {
      location = await getBrowserLocation();
    } catch (locErr) {
      setError(
        locErr instanceof Error
          ? `Location required: ${locErr.message}`
          : "Location required."
      );
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          location,
          // user_profile is null until Supabase + profile UI ship.
          user_profile: null,
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        setError(`Backend error (${res.status}): ${detail}`);
        return;
      }

      const data: ChatResponse = await res.json();
      setAnswer(data.answer ?? "");
      setRecommendations(data.recommendations ?? []);
      setToolsUsed(data.tools_used ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Backend unreachable: ${err.message}`
          : "Backend unreachable."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-4">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold">Forager</h1>
          <p className="text-sm text-gray-500">
            Decide where to eat and what to order.
          </p>
        </div>

        <textarea
          className="min-h-28 rounded-xl border p-3 text-sm"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button
          onClick={sendMessage}
          disabled={loading}
          className="rounded-xl bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask Forager"}
        </button>

        {error && (
          <section className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </section>
        )}

        {answer && (
          <section className="rounded-xl border p-4">
            <h2 className="font-semibold">Answer</h2>
            <p className="mt-2 text-sm">{answer}</p>
            {toolsUsed.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Tools used: {toolsUsed.join(", ")}
              </p>
            )}
          </section>
        )}

        {recommendations.map((rec, index) => (
          <section key={index} className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{rec.place}</h2>
              {rec.google_maps_uri && (
                <a
                  href={rec.google_maps_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 underline"
                >
                  Maps
                </a>
              )}
            </div>

            <p className="mt-1 text-xs text-gray-500">
              {rec.rating != null && (
                <>
                  {rec.rating}★
                  {rec.user_rating_count != null
                    ? ` (${rec.user_rating_count})`
                    : ""}
                </>
              )}
              {rec.distance_miles != null && (
                <> &middot; {rec.distance_miles.toFixed(2)} mi</>
              )}
              {rec.price_level && <> &middot; {rec.price_level}</>}
              {rec.open_now != null && (
                <> &middot; {rec.open_now ? "Open" : "Closed"}</>
              )}
            </p>

            <p className="mt-2 text-sm">
              <strong>Order:</strong> {rec.order}
            </p>

            <p className="mt-2 text-sm">
              <strong>Estimated macros:</strong>{" "}
              {rec.estimated_macros.calories},{" "}
              {rec.estimated_macros.protein},{" "}
              {rec.estimated_macros.carbs}, {rec.estimated_macros.fat}
            </p>

            <p className="mt-2 text-sm">
              <strong>Confidence:</strong> {rec.estimated_macros.confidence}
            </p>

            <p className="mt-2 text-sm text-gray-600">{rec.why}</p>

            {rec.suggested_modifications &&
              rec.suggested_modifications.length > 0 && (
                <div className="mt-2 text-sm">
                  <strong>Suggested modifications:</strong>
                  <ul className="ml-4 list-disc">
                    {rec.suggested_modifications.map((mod, i) => (
                      <li key={i}>{mod}</li>
                    ))}
                  </ul>
                </div>
              )}

            {rec.allergen_warnings && rec.allergen_warnings.length > 0 && (
              <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                <strong>Allergen warnings:</strong>
                <ul className="ml-4 list-disc">
                  {rec.allergen_warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
