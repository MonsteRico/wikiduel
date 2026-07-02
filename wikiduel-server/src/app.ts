import Fastify, { type FastifyInstance } from "fastify";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.get("/", async () => ({
    name: "wikiduel-server",
    status: "ok",
  }));

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
