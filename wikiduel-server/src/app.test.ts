import type { RawData, WebSocket } from "ws";
import { expect, test } from "vitest";

import { buildApp } from "./app.js";

type RoomStateMessage = {
  type: "room-state";
  room: {
    code: string;
    members: Array<{
      id: string;
      name: string;
      role: "host" | "opponent";
      connected: boolean;
      ready: boolean;
    }>;
  };
};

type RoomClosedMessage = {
  type: "room-closed";
  message: string;
};

function nextMessage<T>(socket: WebSocket, type: string): Promise<T> {
  return new Promise((resolve) => {
    const onMessage = (data: RawData) => {
      const message = JSON.parse(data.toString()) as { type: string };

      if (message.type === type) {
        socket.off("message", onMessage);
        resolve(message as T);
      }
    };

    socket.on("message", onMessage);
  });
}

test("GET /health reports that the server is healthy", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/health" });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: "ok" });

  await app.close();
});

test("a two-player lobby supports readiness, starting, and closure", async () => {
  const app = await buildApp();
  await app.ready();

  const hostSocket = await app.injectWS("/ws");
  const createdRoomPromise = nextMessage<RoomStateMessage>(hostSocket, "room-state");
  hostSocket.send(JSON.stringify({ type: "create-room", clientId: "host-id" }));
  const createdRoom = await createdRoomPromise;

  expect(createdRoom.room.code).toMatch(/^[A-Z2-9]{5}$/);
  expect(createdRoom.room.members).toEqual([{
    id: "host-id",
    name: "host",
    role: "host",
    connected: true,
    ready: false,
  }]);

  const opponentSocket = await app.injectWS("/ws");
  const hostJoinedUpdate = nextMessage<RoomStateMessage>(hostSocket, "room-state");
  const opponentJoinedUpdate = nextMessage<RoomStateMessage>(opponentSocket, "room-state");
  opponentSocket.send(JSON.stringify({
    type: "join-room",
    clientId: "opponent-id",
    roomCode: createdRoom.room.code,
  }));

  const [, opponentRoom] = await Promise.all([hostJoinedUpdate, opponentJoinedUpdate]);
  expect(
    opponentRoom.room.members.map(({ name, role }) => ({ name, role })),
  ).toEqual([
      { name: "host", role: "host" },
      { name: "Opponent", role: "opponent" },
    ]);

  const hostReadyUpdate = nextMessage<RoomStateMessage>(hostSocket, "room-state");
  const opponentSeesHostReady = nextMessage<RoomStateMessage>(opponentSocket, "room-state");
  hostSocket.send(JSON.stringify({ type: "set-ready", ready: true }));
  await Promise.all([hostReadyUpdate, opponentSeesHostReady]);

  const hostSeesBothReady = nextMessage<RoomStateMessage>(hostSocket, "room-state");
  const opponentReadyUpdate = nextMessage<RoomStateMessage>(opponentSocket, "room-state");
  opponentSocket.send(JSON.stringify({ type: "set-ready", ready: true }));
  const [readyRoom] = await Promise.all([hostSeesBothReady, opponentReadyUpdate]);
  expect(readyRoom.room.members.every((member) => member.ready)).toBe(true);

  const hostGameStarted = nextMessage(hostSocket, "game-started");
  const opponentGameStarted = nextMessage(opponentSocket, "game-started");
  hostSocket.send(JSON.stringify({ type: "start-game" }));
  await Promise.all([hostGameStarted, opponentGameStarted]);

  const roomClosedPromise = nextMessage<RoomClosedMessage>(hostSocket, "room-closed");
  opponentSocket.terminate();
  const roomClosed = await roomClosedPromise;
  expect(roomClosed.message).toBe("The other player left. The lobby has been closed.");

  hostSocket.terminate();
  await app.close();
});

test("the opponent is notified when the host leaves", async () => {
  const app = await buildApp();
  await app.ready();

  const hostSocket = await app.injectWS("/ws");
  const createdRoomPromise = nextMessage<RoomStateMessage>(hostSocket, "room-state");
  hostSocket.send(JSON.stringify({ type: "create-room", clientId: "departing-host" }));
  const createdRoom = await createdRoomPromise;

  const opponentSocket = await app.injectWS("/ws");
  const hostJoinedUpdate = nextMessage<RoomStateMessage>(hostSocket, "room-state");
  const opponentJoinedUpdate = nextMessage<RoomStateMessage>(opponentSocket, "room-state");
  opponentSocket.send(JSON.stringify({
    type: "join-room",
    clientId: "remaining-opponent",
    roomCode: createdRoom.room.code,
  }));
  await Promise.all([hostJoinedUpdate, opponentJoinedUpdate]);

  const roomClosedPromise = nextMessage<RoomClosedMessage>(opponentSocket, "room-closed");
  hostSocket.terminate();
  const roomClosed = await roomClosedPromise;
  expect(roomClosed.message).toBe("The other player left. The lobby has been closed.");

  opponentSocket.terminate();
  await app.close();
});
