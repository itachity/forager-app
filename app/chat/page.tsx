"use client";

import { useState } from "react";

type Recommendation = {
  place: string;
  order: string;
  estimated_macros: {
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    confidence: string;
  };
  why: string;
};

export default function ChatPage() {
  const [message, setMessage] = useState(
    "cheap high-protein food near OSU under 800 calories"
  );
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  async function sendMessage() {
    setLoading(true);
    setAnswer("");
    setRecommendations([]);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message,
          user_profile: {
            location: "Oregon State University",
            budget: "cheap",
            goal: "high protein",
            max_calories: 800
          }
        })
      });

      const data = await res.json();

      setAnswer(data.answer ?? "No answer returned.");
      setRecommendations(data.recommendations ?? []);
    } catch {
      setAnswer("Backend error. Make sure FastAPI is running on port 8000.");
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

        {answer && (
          <section className="rounded-xl border p-4">
            <h2 className="font-semibold">Answer</h2>
            <p className="mt-2 text-sm">{answer}</p>
          </section>
        )}

        {recommendations.map((rec, index) => (
          <section key={index} className="rounded-xl border p-4">
            <h2 className="font-semibold">{rec.place}</h2>

            <p className="mt-2 text-sm">
              <strong>Order:</strong> {rec.order}
            </p>

            <p className="mt-2 text-sm">
              <strong>Estimated macros:</strong>{" "}
              {rec.estimated_macros.calories},{" "}
              {rec.estimated_macros.protein},{" "}
              {rec.estimated_macros.carbs},{" "}
              {rec.estimated_macros.fat}
            </p>

            <p className="mt-2 text-sm">
              <strong>Confidence:</strong>{" "}
              {rec.estimated_macros.confidence}
            </p>

            <p className="mt-2 text-sm text-gray-600">{rec.why}</p>
          </section>
        ))}
      </div>
    </main>
  );
}