import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { boneyardPlugin } from "boneyard-js/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Captures pixel-perfect skeletons from the real UI while the dev server
    // runs; bones land in src/bones and are loaded via the registry import.
    boneyardPlugin({
      routes: ["/", "/map/amazon", "/map/amazon?tab=interview"],
      wait: 2500,
      // The auth gate blocks the headless capture browser; existing bones in
      // src/bones keep working. To re-capture after UI changes, temporarily
      // blank VITE_SUPABASE_URL and restart dev.
      skipInitial: true,
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.svg", "apple-touch-icon.png"],
      manifest: {
        name: "LeetGraph — LeetCode Roguelike",
        short_name: "LeetGraph",
        description:
          "Grind LeetCode like a roguelike: company roadmaps, Elo rating, rematches, and AI voice interviews.",
        theme_color: "#FFD93D",
        background_color: "#FFFDF5",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache only the app shell + main entry (<2 MB). Everything else
        // (Excalidraw, Mermaid, KaTeX, lazy views) is cached on first use by the
        // runtime rule below, so first visits don't download ~11 MB in the background.
        globPatterns: ["**/*.{html,css,svg,png,ico,webmanifest}", "assets/index-*.js"],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // Never cache Supabase (auth/data must be live).
            urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co"),
            handler: "NetworkOnly",
          },
          {
            // Cache big lazy JS chunks after first load.
            urlPattern: ({ url }) => url.pathname.startsWith("/assets/"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "assets", expiration: { maxEntries: 120 } },
          },
          {
            urlPattern: ({ url }) => url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com",
            handler: "CacheFirst",
            options: { cacheName: "fonts", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
});
