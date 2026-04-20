import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  workers: 1,
  projects: [{ name: "electron" }],
});
