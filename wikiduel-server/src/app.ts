import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";

type ClientMessage = {
  type: "ping";
};

function serializeMessage(type: "welcome" | "pong", message: string): string {
  return JSON.stringify({
    type,
    message,
    sentAt: new Date().toISOString(),
  });
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  await app.register(websocket);

  app.get("/", async () => ({
    name: "wikiduel-server",
    status: "ok",
  }));

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ws", { websocket: true }, (socket) => {
    socket.send(serializeMessage("welcome", "Connected to WikiDuel server"));

    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage;

        if (message.type === "ping") {
          socket.send(serializeMessage("pong", "Pong from WikiDuel server"));
        }
      } catch {
        app.log.warn("Received an invalid WebSocket message");
      }
    });
  });

  return app;
}
