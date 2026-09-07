const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.82;

/** Returns a downscaled variant of a listing photo URL so cards only download
 * the pixels they actually render. Supabase Storage transforms on the fly via
 * query params (degrading gracefully to the original on plans without image
 * transformations); Unsplash source URLs are re-requested at the target size.
 * Base64 data URLs (local dev only) can't be transformed, so they pass through
 * unchanged. */
export function listingImageUrl(url: string, width: number): string {
  if (url.startsWith("data:")) return url;
  if (url.includes("/storage/v1/object/public/")) {
    // Plain object URLs are served as-is with no resizing — Supabase only
    // transforms images requested through the separate /render/image/
    // endpoint, so the width/quality params have to be applied there.
    const renderUrl = url.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/"
    );
    const sep = renderUrl.includes("?") ? "&" : "?";
    return `${renderUrl}${sep}width=${width}&quality=75`;
  }
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
