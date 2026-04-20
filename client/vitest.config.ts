import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
    alias: {
      "@pi-watch/shared": new URL("../shared/src/index.ts", import.meta.url)
        .pathname,
    },
  },
});
