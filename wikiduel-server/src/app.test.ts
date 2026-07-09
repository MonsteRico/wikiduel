import type { RawData, WebSocket } from "ws";
import { expect, test } from "vitest";

import { buildApp } from "./app.js";

type LobbyStateMessage = {
  type: "lobby-state";
  lobby: {
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

type LobbyClosedMessage = {
  type: "lobby-closed";
  message: string;
};

type LobbyErrorMessage = {
  type: "lobby-error";
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

async function createLobby(socket: WebSocket, clientId = "host-id"): Promise<LobbyStateMessage> {
  const lobbyStatePromise = nextMessage<LobbyStateMessage>(socket, "lobby-state");
  socket.send(JSON.stringify({ type: "create-lobby", clientId }));
  return lobbyStatePromise;
}

async function joinLobby(
  hostSocket: WebSocket,
  opponentSocket: WebSocket,
  lobbyCode: string,
  clientId = "opponent-id",
): Promise<LobbyStateMessage> {
  const hostUpdate = nextMessage<LobbyStateMessage>(hostSocket, "lobby-state");
  const opponentUpdate = nextMessage<LobbyStateMessage>(opponentSocket, "lobby-state");
  opponentSocket.send(JSON.stringify({ type: "join-lobby", clientId, lobbyCode }));
  const [, opponentLobby] = await Promise.all([hostUpdate, opponentUpdate]);
  return opponentLobby;
}

async function setReady(
  socket: WebSocket,
  observerSocket: WebSocket,
  ready: boolean,
): Promise<LobbyStateMessage> {
  const lobbyUpdate = nextLobbyUpdate(socket, observerSocket);
  socket.send(JSON.stringify({ type: "set-ready", ready }));
  return lobbyUpdate;
}

async function nextLobbyUpdate(
  socket: WebSocket,
  observerSocket: WebSocket,
): Promise<LobbyStateMessage> {
  const senderUpdate = nextMessage<LobbyStateMessage>(socket, "lobby-state");
  const observerUpdate = nextMessage<LobbyStateMessage>(observerSocket, "lobby-state");
  const [lobby] = await Promise.all([senderUpdate, observerUpdate]);
  return lobby;
}

test("GET /health reports that the server is healthy", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/health" });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: "ok" });

  await app.close();
});

test("responses permit only the approved Wikimedia image origin", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/health" });

  const policy = response.headers["content-security-policy"];
  expect(policy).toContain("img-src 'self' https://upload.wikimedia.org");
  expect(policy).not.toContain("img-src *");
  expect(policy).not.toMatch(/img-src[^;]*\shttps:(?:\s|;|$)/);

  await app.close();
});

test("a two-player lobby supports readiness, starting, and closure", async () => {
  const app = await buildApp();
  await app.ready();

  const hostSocket = await app.injectWS("/ws");
  const createdLobbyPromise = nextMessage<LobbyStateMessage>(hostSocket, "lobby-state");
  hostSocket.send(JSON.stringify({ type: "create-lobby", clientId: "host-id" }));
  const createdLobby = await createdLobbyPromise;

  expect(createdLobby.lobby.code).toMatch(/^[A-Z2-9]{5}$/);
  expect(createdLobby.lobby.members).toEqual([{
    id: "host-id",
    name: "host",
    role: "host",
    connected: true,
    ready: false,
  }]);

  const opponentSocket = await app.injectWS("/ws");
  const hostJoinedUpdate = nextMessage<LobbyStateMessage>(hostSocket, "lobby-state");
  const opponentJoinedUpdate = nextMessage<LobbyStateMessage>(opponentSocket, "lobby-state");
  opponentSocket.send(JSON.stringify({
    type: "join-lobby",
    clientId: "opponent-id",
    lobbyCode: createdLobby.lobby.code,
  }));

  const [, opponentLobby] = await Promise.all([hostJoinedUpdate, opponentJoinedUpdate]);
  expect(
    opponentLobby.lobby.members.map(({ name, role }) => ({ name, role })),
  ).toEqual([
      { name: "host", role: "host" },
      { name: "Opponent", role: "opponent" },
    ]);

  const hostReadyUpdate = nextMessage<LobbyStateMessage>(hostSocket, "lobby-state");
  const opponentSeesHostReady = nextMessage<LobbyStateMessage>(opponentSocket, "lobby-state");
  hostSocket.send(JSON.stringify({ type: "set-ready", ready: true }));
  await Promise.all([hostReadyUpdate, opponentSeesHostReady]);

  const hostSeesBothReady = nextMessage<LobbyStateMessage>(hostSocket, "lobby-state");
  const opponentReadyUpdate = nextMessage<LobbyStateMessage>(opponentSocket, "lobby-state");
  opponentSocket.send(JSON.stringify({ type: "set-ready", ready: true }));
  const [readyLobby] = await Promise.all([hostSeesBothReady, opponentReadyUpdate]);
  expect(readyLobby.lobby.members.every((member) => member.ready)).toBe(true);

  const hostGameStarted = nextMessage(hostSocket, "game-started");
  const opponentGameStarted = nextMessage(opponentSocket, "game-started");
  hostSocket.send(JSON.stringify({ type: "start-game" }));
  await Promise.all([hostGameStarted, opponentGameStarted]);

  const lobbyClosedPromise = nextMessage<LobbyClosedMessage>(hostSocket, "lobby-closed");
  opponentSocket.terminate();
  const lobbyClosed = await lobbyClosedPromise;
  expect(lobbyClosed.message).toBe("The other player left. The lobby has been closed.");

  hostSocket.terminate();
  await app.close();
});

test("the opponent is notified when the host leaves", async () => {
  const app = await buildApp();
  await app.ready();

  const hostSocket = await app.injectWS("/ws");
  const createdLobbyPromise = nextMessage<LobbyStateMessage>(hostSocket, "lobby-state");
  hostSocket.send(JSON.stringify({ type: "create-lobby", clientId: "departing-host" }));
  const createdLobby = await createdLobbyPromise;

  const opponentSocket = await app.injectWS("/ws");
  const hostJoinedUpdate = nextMessage<LobbyStateMessage>(hostSocket, "lobby-state");
  const opponentJoinedUpdate = nextMessage<LobbyStateMessage>(opponentSocket, "lobby-state");
  opponentSocket.send(JSON.stringify({
    type: "join-lobby",
    clientId: "remaining-opponent",
    lobbyCode: createdLobby.lobby.code,
  }));
  await Promise.all([hostJoinedUpdate, opponentJoinedUpdate]);

  const lobbyClosedPromise = nextMessage<LobbyClosedMessage>(opponentSocket, "lobby-closed");
  hostSocket.terminate();
  const lobbyClosed = await lobbyClosedPromise;
  expect(lobbyClosed.message).toBe("The other player left. The lobby has been closed.");

  opponentSocket.terminate();
  await app.close();
});

test("Lobby commands reject malformed messages, missing Lobbies, and additional players", async () => {
  const app = await buildApp();
  await app.ready();

  const unpairedSocket = await app.injectWS("/ws");
  const malformedErrorPromise = nextMessage<LobbyErrorMessage>(unpairedSocket, "lobby-error");
  unpairedSocket.send("not-json");
  await expect(malformedErrorPromise).resolves.toMatchObject({ message: "Invalid message" });

  const missingLobbyErrorPromise = nextMessage<LobbyErrorMessage>(unpairedSocket, "lobby-error");
  unpairedSocket.send(JSON.stringify({
    type: "join-lobby",
    clientId: "unpaired-id",
    lobbyCode: " abcde ",
  }));
  await expect(missingLobbyErrorPromise).resolves.toMatchObject({ message: "Lobby not found" });

  const hostSocket = await app.injectWS("/ws");
  const createdLobby = await createLobby(hostSocket);
  const opponentSocket = await app.injectWS("/ws");
  await joinLobby(hostSocket, opponentSocket, createdLobby.lobby.code);

  const additionalSocket = await app.injectWS("/ws");
  const fullLobbyErrorPromise = nextMessage<LobbyErrorMessage>(additionalSocket, "lobby-error");
  additionalSocket.send(JSON.stringify({
    type: "join-lobby",
    clientId: "additional-id",
    lobbyCode: createdLobby.lobby.code,
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
  await joinLobby(hostSocket, opponentSocket, createdLobby.lobby.code);

  const hostReadyStatePromise = nextLobbyUpdate(hostSocket, opponentSocket);
  hostSocket.send(JSON.stringify({ type: "start-game" }));
  hostSocket.send(JSON.stringify({ type: "set-ready", ready: true }));
  const hostReadyState = await Promise.all([
    rejectMessageUntil(hostSocket, "game-started", hostReadyStatePromise),
    rejectMessageUntil(opponentSocket, "game-started", hostReadyStatePromise),
  ]).then(([state]) => state);
  expect(hostReadyState.lobby.members.find(({ role }) => role === "host")?.ready).toBe(true);
  const bothReadyState = await setReady(opponentSocket, hostSocket, true);
  expect(bothReadyState.lobby.members.find(({ role }) => role === "opponent")?.ready).toBe(true);

  const opponentNotReadyStatePromise = nextLobbyUpdate(opponentSocket, hostSocket);
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
  await joinLobby(hostSocket, opponentSocket, createdLobby.lobby.code);

  await setReady(hostSocket, opponentSocket, true);
  await setReady(opponentSocket, hostSocket, true);
  const hostNotReadyState = await setReady(hostSocket, opponentSocket, false);
  expect(hostNotReadyState.lobby.members.find(({ role }) => role === "host")?.ready).toBe(false);
  const opponentNotReadyState = await setReady(opponentSocket, hostSocket, false);
  expect(opponentNotReadyState.lobby.members.find(({ role }) => role === "opponent")?.ready).toBe(false);

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
  await joinLobby(hostSocket, opponentSocket, createdLobby.lobby.code);

  const lobbyClosedPromise = nextMessage<LobbyClosedMessage>(opponentSocket, "lobby-closed");
  hostSocket.send(JSON.stringify({ type: "leave-lobby" }));
  await expect(lobbyClosedPromise).resolves.toMatchObject({
    message: "The other player left. The lobby has been closed.",
  });

  const replacementSocket = await app.injectWS("/ws");
  const closedLobbyErrorPromise = nextMessage<LobbyErrorMessage>(replacementSocket, "lobby-error");
  replacementSocket.send(JSON.stringify({
    type: "join-lobby",
    clientId: "replacement-id",
    lobbyCode: createdLobby.lobby.code,
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
  await joinLobby(hostSocket, opponentSocket, createdLobby.lobby.code);

  const lobbyClosedPromise = nextMessage<LobbyClosedMessage>(hostSocket, "lobby-closed");
  opponentSocket.send(JSON.stringify({ type: "leave-lobby" }));
  await expect(lobbyClosedPromise).resolves.toMatchObject({
    message: "The other player left. The lobby has been closed.",
  });

  opponentSocket.terminate();
  hostSocket.terminate();
  await app.close();
});
