import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "./wikiduel-contracts/vitest.config.ts",
      "./wikiduel-client/vite.config.ts",
      "./wikiduel-server/vitest.config.ts",
    ],
  },
});
