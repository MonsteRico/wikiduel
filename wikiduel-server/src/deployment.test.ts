import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { buildApp } from "./app.js";
import { preparedArticle } from "./duel-core/fixtures.js";
import { deterministicPromptCatalog } from "./prompt-catalog/fixtures.js";

test("production serves client routes and assets without hiding missing endpoints", async () => {
  const clientRoot = await mkdtemp(join(tmpdir(), "wikiduel-client-"));
  await mkdir(join(clientRoot, "assets"));
  await writeFile(join(clientRoot, "index.html"), "<!doctype html><title>Wiki Duel</title>");
  await writeFile(join(clientRoot, "assets", "app.js"), "console.log('Wiki Duel')");
  const app = await buildApp({ production: true, clientRoot,
    promptCatalog: deterministicPromptCatalog,
    repository: { getByTitle: async () => ({ ok: true, article: preparedArticle }) },
  });
  try {
    for (const url of ["/", "/lobby/ABCDE", "/duel/duel-1?refresh=true"]) {
      const response = await app.inject(url);
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.body).toContain("<title>Wiki Duel</title>");
    }
    const asset = await app.inject("/assets/app.js");
    expect(asset.statusCode).toBe(200);
    expect(asset.headers["content-type"]).toContain("javascript");
    for (const url of ["/assets/missing.js", "/api/unknown", "/lab", "/unknown"]) {
      const response = await app.inject(url);
      expect(response.statusCode).toBe(404);
      expect(response.headers["content-type"]).toContain("application/json");
    }
    expect((await app.inject({ method: "POST", url: "/lobby/ABCDE" })).statusCode).toBe(404);
    expect((await app.inject("/health")).json()).toEqual({ status: "ok" });
    expect((await app.inject("/ready")).json()).toEqual({ status: "ready" });
    const socket = await app.injectWS("/ws");
    expect(socket.readyState).toBe(1);
    socket.close();
  } finally {
    await app.close();
    await rm(clientRoot, { recursive: true, force: true });
  }
});

test("readiness rejects a production app without initialized dependencies", async () => {
  const app = await buildApp({ production: true });
  try {
    expect((await app.inject("/health")).statusCode).toBe(200);
    expect((await app.inject("/ready")).statusCode).toBe(503);
  } finally {
    await app.close();
  }
});
