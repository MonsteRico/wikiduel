import { resolve } from "node:path";
import { parseArgs } from "node:util";
import concurrently from "concurrently";

const { positionals } = parseArgs({ allowPositionals: true, options: {} });
if (positionals.length > 1) {
  throw new Error("Usage: npm run dev -- [prompt-file]");
}

const { result } = concurrently([
  { name: "client", command: "npm run dev --workspace=wikiduel-client", prefixColor: "cyan" },
  {
    name: "server",
    command: "npm run dev --workspace=wikiduel-server",
    prefixColor: "magenta",
    env: positionals[0] === undefined ? {} : {
      WIKIDUEL_PROMPT_FILE: resolve(positionals[0]),
    },
  },
], { killOthersOn: ["failure"] });

try {
  await result;
} catch {
  process.exitCode = 1;
}
