import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import packer from "@kintone/plugin-packer";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const stage = resolve(dist, "plugin-src");
const ppkPath = resolve(root, "private.ppk");

// Assemble the plugin contents: built JS + manifest + config assets + icon.
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const file of ["desktop.js", "mobile.js", "config.js"]) {
  const from = resolve(dist, file);
  if (!existsSync(from)) {
    throw new Error(`Missing build output: ${file}. Run "npm run build" first.`);
  }
  cpSync(from, resolve(stage, file));
}
cpSync(resolve(root, "plugin/manifest.json"), resolve(stage, "manifest.json"));
cpSync(resolve(root, "src/config/config.html"), resolve(stage, "config.html"));
cpSync(resolve(root, "src/config/theme.css"), resolve(stage, "theme.css"));
cpSync(resolve(root, "plugin/icon.png"), resolve(stage, "icon.png"));

// Zip the staged contents in memory.
const zip = new AdmZip();
zip.addLocalFolder(stage);
const contentsZip = zip.toBuffer();

const privateKey = existsSync(ppkPath) ? readFileSync(ppkPath, "utf8") : undefined;
const output = await packer(contentsZip, privateKey);

writeFileSync(resolve(dist, "plugin.zip"), output.plugin);
if (!privateKey) {
  // First run: keep the generated key so future builds keep the same plugin id.
  writeFileSync(ppkPath, output.privateKey);
  console.log("Generated private.ppk (kept out of git). Reuse it for future builds.");
}
console.log(`Built dist/plugin.zip (plugin id: ${output.id}).`);
