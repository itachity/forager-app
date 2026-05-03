"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, ImageUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EyebrowLabel } from "./EyebrowLabel";
import { useT } from "@/lib/forager-i18n-context";

export type ScanCaptureMode = "food" | "menu";

export function ScanCapture({
  eyebrow,
  heading,
  subtitle,
  helperPrimary,
  helperSecondary,
  onSubmit,
  busy,
  loadingMessage,
  loadingDetail,
}: {
  eyebrow: string;
  heading: string;
  subtitle: string;
  helperPrimary: string;
  helperSecondary: string;
  onSubmit: (file: File) => void | Promise<void>;
  busy?: boolean;
  loadingMessage?: string;
  loadingDetail?: string;
}) {
  const id = useId();
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const cameraInputId = `${id}-camera-input`;
  const fileInputId = `${id}-file-input`;

  const onPick = (file: File | null) => {
    if (!file || busy) return;

    const url = URL.createObjectURL(file);

    setPreviewUrl((oldUrl) => {
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      return url;
    });

    void onSubmit(file);
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const openCamera = () => {
    if (!busy) cameraRef.current?.click();
  };

  const openUpload = () => {
    if (!busy) fileRef.current?.click();
  };

  return (
    <main className="min-h-screen pb-40">
      <div className="max-w-xl mx-auto px-5 pt-4">
        <EyebrowLabel className="mb-3">{eyebrow}</EyebrowLabel>

        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          {heading}
        </h1>

        <p className="text-muted-foreground mt-2 leading-relaxed mb-6">
          {subtitle}
        </p>

        <div
          role="button"
          tabIndex={busy ? -1 : 0}
          aria-disabled={busy}
          onClick={openCamera}
          onKeyDown={(e) => {
            if (busy) return;

            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openCamera();
            }
          }}
          className={[
            "forager-card aspect-[4/5] overflow-hidden flex items-center justify-center",
            "bg-primary-soft/40 border-dashed border-2 border-border",
            "cursor-pointer select-none outline-none",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            busy ? "pointer-events-none opacity-80" : "",
          ].join(" ")}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={t("capture.uploadPreview")}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center px-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Camera size={26} />
              </div>

              <p className="font-medium">{helperPrimary}</p>

              <p className="text-sm text-muted-foreground mt-1">
                {helperSecondary}
              </p>
            </div>
          )}
        </div>

        {busy && (
          <div className="mt-5 flex flex-col items-center text-center text-primary">
            <Loader2 className="animate-spin" />

            <p className="font-medium mt-2">
              {loadingMessage ?? t("capture.analyzing")}
            </p>

            {loadingDetail && (
              <p className="text-sm text-muted-foreground mt-1">
                {loadingDetail}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-background via-background/95 to-background/0 pointer-events-none">
        <div className="max-w-xl mx-auto grid grid-cols-2 gap-3 pointer-events-auto">
          <Button
            type="button"
            variant="forest"
            size="xl"
            onClick={openCamera}
            disabled={busy}
          >
            <Camera />
            {t("capture.camera")}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="xl"
            className="rounded-2xl"
            onClick={openUpload}
            disabled={busy}
          >
            <ImageUp />
            {t("capture.upload")}
          </Button>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          {busy ? t("capture.processing") : t("capture.tip")}
        </p>
      </div>

      <input
        id={cameraInputId}
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      <input
        id={fileInputId}
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </main>
  );
}