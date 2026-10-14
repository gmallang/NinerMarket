const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.82;

/** Returns a listing photo URL ready to drop into an <img>. Supabase Storage
 * URLs are served as-is: the on-the-fly resize endpoint (/render/image/) is a
 * Supabase Pro-plan feature that fails on the free plan, so we don't use it.
 * Cards request the pre-generated `photos_small` thumbnail (Backend/storage.py)
 * instead, so the small file is already the one being fetched. Unsplash source
 * URLs are re-requested at the target width. Base64 data URLs (local dev only)
 * pass through unchanged. */
export function listingImageUrl(url: string, width: number): string {
  if (url.startsWith("data:")) return url;
  if (url.startsWith("https://images.unsplash.com/")) {
    // Width only — no forced h/fit=crop, which pre-cropped photos to squares
    // at the CDN and made subjects look zoomed-in. Containers crop via CSS.
    const u = new URL(url);
    u.searchParams.set("w", String(width));
    u.searchParams.set("auto", "format");
    return u.toString();
  }
  return url;
}

/** Downscales and re-encodes an image file to a JPEG data URL, keeping the
 * longest edge at or under MAX_DIMENSION. Cuts typical phone-camera photos
 * (several MB) down to a few hundred KB before they hit storage/bandwidth. */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image"));
    };
    img.src = objectUrl;
  });
}
