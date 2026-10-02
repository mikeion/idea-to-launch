import { defineConfig } from "vite"

export default defineConfig({
  // Relative asset paths so the build works from any static host or subfolder.
  base: "./",
  server: { host: true },
  // Phaser alone is ~1.2MB minified; that is expected for a single-bundle game.
  build: { chunkSizeWarningLimit: 1500 },
})
