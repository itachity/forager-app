"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Toast = { id: number; message: string; tone: "default" | "error" | "success" };

type ToastApi = {
  show: (message: string, tone?: Toast["tone"]) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const show = useCallback((message: string, tone: Toast["tone"] = "default") => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              "pointer-events-auto rounded-2xl px-4 py-3 text-sm font-medium shadow-lg max-w-sm w-fit " +
              (t.tone === "error"
                ? "bg-destructive text-destructive-foreground"
                : t.tone === "success"
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground text-background")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Quietly degrade if used outside provider (e.g. SSR fallback)
    return {
      show: (m: string) => {
        if (typeof window !== "undefined") console.log("[toast]", m);
      },
    };
  }
  return ctx;
}

// Convenience event-based API for non-component callers (e.g. lib/forager-api.ts).
// Components subscribe via ToastProvider; callers fire `window.dispatchEvent(toastEvent("...", "error"))`.
export function toastEvent(message: string, tone: Toast["tone"] = "default") {
  return new CustomEvent("forager:toast", { detail: { message, tone } });
}

if (typeof window !== "undefined") {
  // no-op marker; kept for future cross-component bus if needed
}
