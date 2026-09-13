import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // ML-DSA-65 keygen dominates: ~100 ms per plane connect, and the suite
    // stands up several planes.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
