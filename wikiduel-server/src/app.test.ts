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

type RoomErrorMessage = {
  type: "room-error";
  message: string;
};

type ServerMessage = {
  type: string;
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

function rejectMessageUntil<T>(socket: WebSocket, type: string, boundary: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: RawData) => {
      const message = JSON.parse(data.toString()) as ServerMessage;

      if (message.type === type) {
        socket.off("message", onMessage);
        reject(new Error(`Unexpected ${type} message`));
      }
    };
    socket.on("message", onMessage);

    boundary.then((result) => {
      socket.off("message", onMessage);
      resolve(result);
    }, reject);
  });
}

async function createLobby(socket: WebSocket, clientId = "host-id"): Promise<RoomStateMessage> {
  const roomStatePromise = nextMessage<RoomStateMessage>(socket, "room-state");
  socket.send(JSON.stringify({ type: "create-room", clientId }));
  return roomStatePromise;
}

async function joinLobby(
  hostSocket: WebSocket,
  opponentSocket: WebSocket,
  roomCode: string,
  clientId = "opponent-id",
): Promise<RoomStateMessage> {
  const hostUpdate = nextMessage<RoomStateMessage>(hostSocket, "room-state");
  const opponentUpdate = nextMessage<RoomStateMessage>(opponentSocket, "room-state");
  opponentSocket.send(JSON.stringify({ type: "join-room", clientId, roomCode }));
  const [, opponentRoom] = await Promise.all([hostUpdate, opponentUpdate]);
  return opponentRoom;
}

async function setReady(
  socket: WebSocket,
  observerSocket: WebSocket,
  ready: boolean,
): Promise<RoomStateMessage> {
  const roomUpdate = nextRoomUpdate(socket, observerSocket);
  socket.send(JSON.stringify({ type: "set-ready", ready }));
  return roomUpdate;
}

async function nextRoomUpdate(
  socket: WebSocket,
  observerSocket: WebSocket,
): Promise<RoomStateMessage> {
  const senderUpdate = nextMessage<RoomStateMessage>(socket, "room-state");
  const observerUpdate = nextMessage<RoomStateMessage>(observerSocket, "room-state");
  const [room] = await Promise.all([senderUpdate, observerUpdate]);
  return room;
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

test("Lobby commands reject malformed messages, missing Lobbies, and additional players", async () => {
  const app = await buildApp();
  await app.ready();

  const unpairedSocket = await app.injectWS("/ws");
  const malformedErrorPromise = nextMessage<RoomErrorMessage>(unpairedSocket, "room-error");
  unpairedSocket.send("not-json");
  await expect(malformedErrorPromise).resolves.toMatchObject({ message: "Invalid message" });

  const missingLobbyErrorPromise = nextMessage<RoomErrorMessage>(unpairedSocket, "room-error");
  unpairedSocket.send(JSON.stringify({
    type: "join-room",
    clientId: "unpaired-id",
    roomCode: " abcde ",
  }));
  await expect(missingLobbyErrorPromise).resolves.toMatchObject({ message: "Lobby not found" });

  const hostSocket = await app.injectWS("/ws");
  const createdLobby = await createLobby(hostSocket);
  const opponentSocket = await app.injectWS("/ws");
  await joinLobby(hostSocket, opponentSocket, createdLobby.room.code);

  const additionalSocket = await app.injectWS("/ws");
  const fullLobbyErrorPromise = nextMessage<RoomErrorMessage>(additionalSocket, "room-error");
  additionalSocket.send(JSON.stringify({
    type: "join-room",
    clientId: "additional-id",
    roomCode: createdLobby.room.code,
  }));
  await expect(fullLobbyErrorPromise).resolves.toMatchObject({ message: "Lobby is full" });

  unpairedSocket.terminate();
  additionalSocket.terminate();
  opponentSocket.terminate();
  hostSocket.terminate();
  await app.close();
});

test("only a Host can start after both Player Sessions are ready", async () => {
  const app = await buildApp();
  await app.ready();

  const hostSocket = await app.injectWS("/ws");
  const createdLobby = await createLobby(hostSocket);
  const opponentSocket = await app.injectWS("/ws");
  await joinLobby(hostSocket, opponentSocket, createdLobby.room.code);

  const hostReadyStatePromise = nextRoomUpdate(hostSocket, opponentSocket);
  hostSocket.send(JSON.stringify({ type: "start-game" }));
  hostSocket.send(JSON.stringify({ type: "set-ready", ready: true }));
  const hostReadyState = await Promise.all([
    rejectMessageUntil(hostSocket, "game-started", hostReadyStatePromise),
    rejectMessageUntil(opponentSocket, "game-started", hostReadyStatePromise),
  ]).then(([state]) => state);
  expect(hostReadyState.room.members.find(({ role }) => role === "host")?.ready).toBe(true);
  const bothReadyState = await setReady(opponentSocket, hostSocket, true);
  expect(bothReadyState.room.members.find(({ role }) => role === "opponent")?.ready).toBe(true);

  const opponentNotReadyStatePromise = nextRoomUpdate(opponentSocket, hostSocket);
  opponentSocket.send(JSON.stringify({ type: "start-game" }));
  opponentSocket.send(JSON.stringify({ type: "set-ready", ready: false }));
  await Promise.all([
    rejectMessageUntil(hostSocket, "game-started", opponentNotReadyStatePromise),
    rejectMessageUntil(opponentSocket, "game-started", opponentNotReadyStatePromise),
  ]);
  await setReady(opponentSocket, hostSocket, true);

  const hostGameStarted = nextMessage(hostSocket, "game-started");
  const opponentGameStarted = nextMessage(opponentSocket, "game-started");
  hostSocket.send(JSON.stringify({ type: "start-game" }));
  await Promise.all([hostGameStarted, opponentGameStarted]);

  opponentSocket.terminate();
  hostSocket.terminate();
  await app.close();
});

test("either Player Session can change readiness", async () => {
  const app = await buildApp();
  await app.ready();

  const hostSocket = await app.injectWS("/ws");
  const createdLobby = await createLobby(hostSocket);
  const opponentSocket = await app.injectWS("/ws");
  await joinLobby(hostSocket, opponentSocket, createdLobby.room.code);

  await setReady(hostSocket, opponentSocket, true);
  await setReady(opponentSocket, hostSocket, true);
  const hostNotReadyState = await setReady(hostSocket, opponentSocket, false);
  expect(hostNotReadyState.room.members.find(({ role }) => role === "host")?.ready).toBe(false);
  const opponentNotReadyState = await setReady(opponentSocket, hostSocket, false);
  expect(opponentNotReadyState.room.members.find(({ role }) => role === "opponent")?.ready).toBe(false);

  opponentSocket.terminate();
  hostSocket.terminate();
  await app.close();
});

test("explicit departure closes a paired Lobby and prevents replacement players", async () => {
  const app = await buildApp();
  await app.ready();

  const hostSocket = await app.injectWS("/ws");
  const createdLobby = await createLobby(hostSocket);
  const opponentSocket = await app.injectWS("/ws");
  await joinLobby(hostSocket, opponentSocket, createdLobby.room.code);

  const roomClosedPromise = nextMessage<RoomClosedMessage>(opponentSocket, "room-closed");
  hostSocket.send(JSON.stringify({ type: "leave-room" }));
  await expect(roomClosedPromise).resolves.toMatchObject({
    message: "The other player left. The lobby has been closed.",
  });

  const replacementSocket = await app.injectWS("/ws");
  const closedLobbyErrorPromise = nextMessage<RoomErrorMessage>(replacementSocket, "room-error");
  replacementSocket.send(JSON.stringify({
    type: "join-room",
    clientId: "replacement-id",
    roomCode: createdLobby.room.code,
  }));
  await expect(closedLobbyErrorPromise).resolves.toMatchObject({ message: "Lobby not found" });

  replacementSocket.terminate();
  opponentSocket.terminate();
  hostSocket.terminate();
  await app.close();
});

test("the Host is notified when the Opponent explicitly departs", async () => {
  const app = await buildApp();
  await app.ready();

  const hostSocket = await app.injectWS("/ws");
  const createdLobby = await createLobby(hostSocket);
  const opponentSocket = await app.injectWS("/ws");
  await joinLobby(hostSocket, opponentSocket, createdLobby.room.code);

  const roomClosedPromise = nextMessage<RoomClosedMessage>(hostSocket, "room-closed");
  opponentSocket.send(JSON.stringify({ type: "leave-room" }));
  await expect(roomClosedPromise).resolves.toMatchObject({
    message: "The other player left. The lobby has been closed.",
  });

  opponentSocket.terminate();
  hostSocket.terminate();
  await app.close();
});
