import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs, so the build works from any GitHub Pages sub-path
  // without hard-coding the repository name.
  base: "./",
  resolve: {
    // The demo compiles the library from source, so editing src/ updates it live.
    alias: {
      "react-bibtex": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    fs: { allow: [".."] },
  },
});
