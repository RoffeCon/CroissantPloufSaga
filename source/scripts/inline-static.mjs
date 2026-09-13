// Browsers refuse to load ES modules over file://, which is why double-clicking
// index.html previously showed a blank page. The standalone bundle is built as a
// classic IIFE, so we only need to drop the module attributes from the tag.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = resolve(root, "dist/static/index.html");
const html = readFileSync(htmlPath, "utf8");

const match = html.match(/<script\b[^>]*\bsrc="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/);
if (!match) {
  console.error("inline-static: could not find the built script tag in index.html");
  process.exit(1);
}

const patched = html
  .replace(match[0], `<script src="./${match[1]}" defer></script>`)
  .replaceAll(" crossorigin", "");
writeFileSync(htmlPath, patched);
console.log("inline-static: script tag switched to a classic (file://-safe) script");
