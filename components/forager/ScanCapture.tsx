"use client";

import { useRef, useState } from "react";
import { Camera, ImageUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EyebrowLabel } from "./EyebrowLabel";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onPick = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    void onSubmit(file);
  };

  return (
    <main className="min-h-screen pb-32">
      <div className="max-w-xl mx-auto px-5 pt-4">
        <EyebrowLabel className="mb-3">{eyebrow}</EyebrowLabel>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-muted-foreground mt-2 leading-relaxed mb-6">{subtitle}</p>

        <div className="forager-card aspect-[4/5] overflow-hidden flex items-center justify-center bg-primary-soft/40 border-dashed border-2 border-border">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="upload preview" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center px-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Camera size={26} />
              </div>
              <p className="font-medium">{helperPrimary}</p>
              <p className="text-sm text-muted-foreground mt-1">{helperSecondary}</p>
            </div>
          )}
        </div>

        {busy && (
          <div className="mt-5 flex flex-col items-center text-center text-primary">
            <Loader2 className="animate-spin" />
            <p className="font-medium mt-2">{loadingMessage ?? "Analyzing…"}</p>
            {loadingDetail && (
              <p className="text-sm text-muted-foreground mt-1">{loadingDetail}</p>
            )}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 px-5 pb-5 pt-4 bg-gradient-to-t from-background via-background/95 to-background/0">
        <div className="max-w-xl mx-auto grid grid-cols-2 gap-3">
          <Button
            variant="forest"
            size="xl"
            onClick={() => cameraRef.current?.click()}
            disabled={busy}
          >
            <Camera /> Camera
          </Button>
          <Button
            variant="outline"
            size="xl"
            className="rounded-2xl"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <ImageUp /> Upload
          </Button>
        </div>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </main>
  );
}
