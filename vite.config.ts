import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { boneyardPlugin } from "boneyard-js/vite";

export default defineConfig({
  plugins: [
    react(),
    // Captures pixel-perfect skeletons from the real UI while the dev server
    // runs; bones land in src/bones and are loaded via the registry import.
    boneyardPlugin({
      routes: ["/", "/map/amazon", "/map/amazon?tab=interview"],
      wait: 2500,
    }),
  ],
});
