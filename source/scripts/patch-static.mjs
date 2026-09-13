// Makes the prerendered index.html portable: TanStack Start emits a few
// "/./assets/..." URLs that only work at a domain root. Rewriting them to
// "./assets/..." lets the built site run from any subfolder (e.g. GitHub Pages).
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../dist/client/index.html", import.meta.url);
const html = readFileSync(file, "utf8");
const patched = html.replaceAll('"/./assets/', '"./assets/');
if (patched === html) {
  console.error("patch-static: no '/./assets/' URLs found in dist/client/index.html");
  process.exit(1);
}
writeFileSync(file, patched);
console.log("patch-static: rewrote absolute asset URLs to relative ones");
