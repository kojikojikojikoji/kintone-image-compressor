import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const entries = [
  { name: "desktop", global: "kintoneImageCompressorDesktop" },
  { name: "mobile", global: "kintoneImageCompressorMobile" },
  { name: "config", global: "kintoneImageCompressorConfig" },
];

for (const [index, entry] of entries.entries()) {
  await build({
    root,
    configFile: false,
    build: {
      target: "es2019",
      outDir: "dist",
      // Clear dist on the first pass only, then append the rest.
      emptyOutDir: index === 0,
      minify: "esbuild",
      lib: {
        entry: resolve(root, `src/${entry.name}/index.ts`),
        formats: ["iife"],
        name: entry.global,
        fileName: () => `${entry.name}.js`,
      },
    },
  });
}
