/**
 * Resize an image file so its longest edge is at most `maxEdge` pixels.
 * Re-encodes to JPEG at the given quality. Returns the original file on any
 * failure so callers can always fall back to uploading what they had.
 */
export async function resizeImage(file: File, maxEdge = 1024, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  if (typeof document === "undefined") return file;
  try {
    const dataUrl = await readAsDataURL(file);
    const img = await loadImage(dataUrl);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    if (longest <= maxEdge) return file;
    const scale = maxEdge / longest;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    );
    return blob ?? file;
  } catch (e) {
    console.warn("[forager] resizeImage failed; uploading original", e);
    return file;
  }
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}
