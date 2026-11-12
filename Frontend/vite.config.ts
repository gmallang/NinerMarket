import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => {
  // A Vercel build without VITE_API_URL produces a bundle whose API base falls
  // back to "/api". The SPA rewrite then answers /api/* with index.html
  // (200, text/html - confirmed against production), so every request fails as
  // a JSON parse error and the app looks broken with nothing in the server logs.
  // Fail the build instead of shipping that.
  //
  // Scoped to Vercel: locally "/api" is exactly what the dev proxy below serves.
  if (command === "build" && process.env.VERCEL && !process.env.VITE_API_URL) {
    throw new Error(
      "VITE_API_URL is not set for this Vercel build. Without it the bundle falls " +
        'back to "/api", which the SPA rewrite answers with index.html. Set ' +
        "VITE_API_URL to the backend origin (e.g. https://api.ninermarket.com) in " +
        "the project's environment variables, then redeploy.",
    );
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
