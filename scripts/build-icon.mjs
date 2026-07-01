import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Render plugin/icon.svg to plugin/icon.png (56x56). Prefers rsvg-convert,
// falls back to macOS sips. If neither exists, keep the committed PNG and warn.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = resolve(root, "plugin/icon.svg");
const png = resolve(root, "plugin/icon.png");

function has(cmd) {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (has("rsvg-convert")) {
  execFileSync("rsvg-convert", ["-w", "56", "-h", "56", "-o", png, svg]);
  console.log("Rendered icon.png with rsvg-convert.");
} else if (has("sips")) {
  execFileSync("sips", ["-s", "format", "png", "-z", "56", "56", svg, "--out", png]);
  console.log("Rendered icon.png with sips.");
} else if (existsSync(png)) {
  console.warn("No SVG rasterizer found; keeping the existing icon.png.");
} else {
  throw new Error("No SVG rasterizer (rsvg-convert or sips) and no existing icon.png.");
}
