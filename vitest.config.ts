import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "./wikiduel-client/vite.config.ts",
      "./wikiduel-server/vitest.config.ts",
    ],
  },
});
