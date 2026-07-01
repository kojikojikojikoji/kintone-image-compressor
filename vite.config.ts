import { resolve } from "node:path";
import { defineConfig } from "vite";

// Default config drives `vite build --watch` (dev) for the desktop entry. The
// production build (npm run build) runs scripts/build.mjs, which builds
// desktop, mobile, and config as separate self-contained IIFE bundles. A single
// Rollup pass cannot emit multiple IIFE outputs, so each entry builds in its own
// pass. All dependencies are inlined; kintone forbids loading scripts from a CDN.
export default defineConfig({
  build: {
    target: "es2019",
    outDir: "dist",
    emptyOutDir: false,
    minify: "esbuild",
    lib: {
      entry: resolve(__dirname, "src/desktop/index.ts"),
      formats: ["iife"],
      name: "kintoneImageCompressorDesktop",
      fileName: () => "desktop.js",
    },
  },
});
