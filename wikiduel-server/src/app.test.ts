import assert from "node:assert/strict";
import { test } from "node:test";
import type { RawData, WebSocket } from "ws";

import { buildApp } from "./app.js";

type RoomStateMessage = {
  type: "room-state";
  room: {
    code: string;
    members: Array<{ id: string; name: string; connected: boolean }>;
  };
};

function nextRoomState(socket: WebSocket): Promise<RoomStateMessage> {
  return new Promise((resolve) => {
    const onMessage = (data: RawData) => {
      const message = JSON.parse(data.toString()) as { type: string };

      if (message.type === "room-state") {
        socket.off("message", onMessage);
        resolve(message as RoomStateMessage);
      }
    };

    socket.on("message", onMessage);
  });
}

test("GET /health reports that the server is healthy", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });

  await app.close();
});

test("clients can create and join a room with live presence", async () => {
  const app = await buildApp();
  await app.ready();

  const hostSocket = await app.injectWS("/ws");
  const createdRoomPromise = nextRoomState(hostSocket);
  hostSocket.send(JSON.stringify({ type: "create-room", clientId: "host-id" }));
  const createdRoom = await createdRoomPromise;

  assert.match(createdRoom.room.code, /^[A-Z2-9]{5}$/);
  assert.deepEqual(createdRoom.room.members, [
    { id: "host-id", name: "Host", connected: true },
  ]);

  const guestSocket = await app.injectWS("/ws");
  const hostUpdatePromise = nextRoomState(hostSocket);
  const guestUpdatePromise = nextRoomState(guestSocket);
  guestSocket.send(JSON.stringify({
    type: "join-room",
    clientId: "guest-id",
    roomCode: createdRoom.room.code,
  }));

  const [hostUpdate, guestUpdate] = await Promise.all([hostUpdatePromise, guestUpdatePromise]);
  assert.equal(hostUpdate.room.members.length, 2);
  assert.equal(guestUpdate.room.members.length, 2);
  assert.equal(guestUpdate.room.members[1]?.name, "Player 2");

  const disconnectedUpdatePromise = nextRoomState(hostSocket);
  guestSocket.terminate();
  const disconnectedUpdate = await disconnectedUpdatePromise;
  assert.equal(disconnectedUpdate.room.members[1]?.connected, false);

  hostSocket.terminate();
  await app.close();
});
