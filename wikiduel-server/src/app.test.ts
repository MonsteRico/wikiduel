import assert from "node:assert/strict";
import { test } from "node:test";
import type { RawData, WebSocket } from "ws";

import { buildApp } from "./app.js";

type ServerMessage = {
  type: "welcome" | "pong";
  message: string;
  sentAt: string;
};

function nextMessage(socket: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve) => {
    socket.once("message", (data: RawData) => {
      resolve(JSON.parse(data.toString()) as ServerMessage);
    });
  });
}

test("GET /health reports that the server is healthy", async () => {
  const app = await buildApp();

  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });

  await app.close();
});

test("WebSocket clients receive a pong", async () => {
  const app = await buildApp();
  await app.ready();

  const socket = await app.injectWS("/ws");
  const pongPromise = nextMessage(socket);

  socket.send(JSON.stringify({ type: "ping" }));
  const pong = await pongPromise;
  assert.equal(pong.type, "pong");
  assert.equal(pong.message, "Pong from WikiDuel server");

  socket.terminate();
  await app.close();
});
