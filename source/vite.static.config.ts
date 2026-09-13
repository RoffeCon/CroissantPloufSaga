import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// Standalone build: one self-contained index.html (classic script, inlined CSS/JS)
// so the game also runs when opened straight from disk (file://), plus on any
// static host or GitHub Pages subfolder.
export default defineConfig({
  root: "static",
  base: "./",
  publicDir: "../public",
  plugins: [tailwindcss()],
  build: {
    outDir: "../dist/static",
    emptyOutDir: true,
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: "index.html",
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "assets/game.js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
