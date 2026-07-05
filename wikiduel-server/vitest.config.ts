import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const serverRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, serverRoot, "");

  return {
    test: {
      name: "server",
      include: ["src/**/*.test.ts"],
      clearMocks: true,
      env,
    },
  };
});
