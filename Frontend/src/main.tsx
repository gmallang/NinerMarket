import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import App from "./app/App";
import "./styles/index.css";

// Google's redirect-mode OAuth callback (see LoginPage's `login_uri`) bounces
// the system browser back to a custom-scheme deep link when we're inside the
// native app, since there's no page for the backend to redirect a bare
// website URL to — the app isn't a browser tab. Capacitor hands us that URL
// here; turn its fragment into a same-origin navigation to /login so the
// existing hash-based token handling in LoginPage picks it up exactly like
// it does for the plain website redirect.
if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener("appUrlOpen", ({ url }) => {
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : "";
    // The app is very often already sitting on /login when this fires (it's
    // where an unauthenticated user starts). Navigating to the same path
    // with only the hash changed is a same-document navigation — it updates
    // the URL bar but doesn't reload, so LoginPage's mount-time token read
    // never re-runs. A changing query param forces a real distinct URL, so
    // this always triggers a full reload regardless of the current path.
    window.location.href = `${window.location.origin}/login?dl=${Date.now()}${hash}`;
  });
}

// A tab left open across a deploy holds chunk hashes that no longer exist
// on the server (every lazy-loaded route) — Vite fires this event when such
// a fetch fails. Reload once to pick up the current build instead of
// surfacing the error boundary or leaving a feature silently broken.
window.addEventListener("vite:preloadError", () => {
  const key = "nmk-chunk-reload";
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    {/* The insights script only exists on Vercel deploys with Web Analytics
        enabled — loading it in dev just produces a console 404. */}
    {import.meta.env.PROD && <Analytics />}
  </StrictMode>
);

// Reaching this point means the current build loaded fine — clear both
// reload guards so a later deploy or a later dead session (while this tab
// is still open) can trigger the self-heal reload again instead of being
// permanently silenced for the rest of this tab's session.
sessionStorage.removeItem("nmk-chunk-reload");
sessionStorage.removeItem("nmk-session-reload");
