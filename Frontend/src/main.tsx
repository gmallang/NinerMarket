import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./app/App";
import "./styles/index.css";

// A tab left open across a deploy holds chunk hashes that no longer exist
// on the server (every lazy-loaded route, plus dynamic imports like the
// search bar's fuse.js) — Vite fires this event when such a fetch fails.
// Reload once to pick up the current build instead of surfacing the error
// boundary or leaving a feature silently broken.
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

// Reaching this point means the current build loaded fine — clear the guard
// so a later deploy (while this tab is still open) can trigger the
// self-heal reload again instead of being permanently silenced for the
// rest of this tab's session.
sessionStorage.removeItem("nmk-chunk-reload");
