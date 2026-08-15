// Web Push (Push API) setup. Lets a signed-in user opt in to real OS-level
// notifications for new messages/offers/listing updates even when they don't
// have a NinerMarket tab open — the realtime broadcast used for the in-app
// bell badge only reaches an already-open tab.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
  );
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/** Requests notification permission (must be called from a user gesture,
 * e.g. a click handler) and subscribes this browser to Web Push. Returns
 * null if unsupported, denied, or the user dismissed the permission prompt. */
export async function enablePush(vapidPublicKey: string): Promise<PushSubscription | null> {
  if (!pushSupported() || !vapidPublicKey) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });
}
