import type { RawData, WebSocket } from "ws";
import { expect, test } from "vitest";
import type { PreparingDuelProjection, StartDuelRejectionReason, PlayableArticle } from "@wikiduel/contracts";

import { preparedArticle } from "./duel-core/fixtures.js";
import { buildApp } from "./app.js";
import { deterministicPromptCatalog } from "./prompt-catalog/fixtures.js";
import { decodeServerMessage, type DuelProjection } from "@wikiduel/contracts";

function nextRound(socket: WebSocket, phase: DuelProjection["phase"]): Promise<DuelProjection> {
  return new Promise((resolve) => {
    const listener = (data: RawData) => {
      const result = decodeServerMessage(JSON.parse(data.toString()));
      if (result.ok && result.message.type === "duel-state"
        && result.message.duel.phase === phase && result.message.duel.round.article) {
        socket.off("message", listener);
        resolve(result.message.duel);
      }
    };
    socket.on("message", listener);
  });
}

function navigationResult(socket: WebSocket, requestId: string): Promise<{ accepted: boolean }> {
  return new Promise((resolve) => {
    const listener = (raw: RawData) => {
      const decoded = decodeServerMessage(JSON.parse(raw.toString()));
      if (decoded.ok && decoded.message.type === "navigation-result" && decoded.message.requestId === requestId) {
        socket.off("message", listener);
        resolve(decoded.message);
      }
    };
    socket.on("message", listener);
  });
}

test.each(["throw", "failure"])("two players serialize Navigation, keep routes private and resolve the first Target Arrival with lookup %s", async (failure) => {
  const alias = { pageId: 42, title: "Linked redirect" };
  const secret = { pageId: 43, title: "Private canonical destination" };
  const target = deterministicPromptCatalog.prompts[0]!.target;
  const broken = { pageId: 44, title: "Unavailable" };
  const start: PlayableArticle = { ...preparedArticle, document: { ...preparedArticle.document,
    blocks: [{ type: "paragraph", children: [alias, target, broken].map((destination) => ({
      type: "navigation", destination, children: [{ type: "text", value: destination.title }],
    })) }] } };
  const destination: PlayableArticle = { ...preparedArticle, identity: secret,
    document: { title: secret.title, tableOfContents: [], blocks: [{ type: "infobox",
      title: [{ type: "text", value: "Private content" }], sections: [{ items: [{ blocks: [
        { type: "paragraph", children: [{ type: "navigation", destination: target,
          children: [{ type: "text", value: "Target" }] }] },
      ] }] }] }] } };
  const lookups: Array<{ title: string; resolve: (article: PlayableArticle) => void }> = [];
  let now = 100_000;
  let activate = () => {};
  const app = await buildApp({ promptRandom: () => 0, now: () => now,
    schedule: (callback, delay) => { if (delay === 3000) activate = callback; return () => {}; },
    repository: { getByTitle: async (title) => {
      if (title === start.identity.title) return { ok: true, article: start };
      if (title === broken.title) {
        if (failure === "throw") throw new Error("Upstream unavailable");
        return { ok: false, failure: { code: "article-not-found" } };
      }
      const article = await new Promise<PlayableArticle>((resolve) => lookups.push({ title, resolve }));
      return { ok: true, article };
    } },
  });
  await app.ready();
  const host = await app.injectWS("/ws");
  const opponent = await app.injectWS("/ws");
  const hostStates: DuelProjection[] = [];
  const opponentStates: DuelProjection[] = [];
  for (const [socket, states] of [[host, hostStates], [opponent, opponentStates]] as const) {
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === "duel-state") {
        expect(decodeServerMessage(message).ok).toBe(true);
        states.push(message.duel);
      }
    });
  }
  const flush = async (socket: WebSocket) => {
    const pong = nextMessage(socket, "pong");
    socket.send(JSON.stringify({ type: "ping" }));
    await pong;
  };
  try {
    const lobby = await createLobby(host);
    await joinLobby(host, opponent, lobby.lobby.code);
    await setReady(host, opponent, true);
    await setReady(opponent, host, true);
    const prepared = [nextRound(host, "preparing"), nextRound(opponent, "preparing")];
    host.send(JSON.stringify({ type: "start-duel" }));
    const [duel] = await Promise.all(prepared);
    const ids = { duelId: duel!.id, roundId: duel!.round.id };
    const command = { type: "navigate", ...ids, requestId: "move", source: start.identity,
      expectedClicks: 0, destination: alias };
    const reject = async (socket: WebSocket, overrides: object) => {
      const result = nextMessage(socket, "navigation-result");
      socket.send(JSON.stringify({ ...command, ...overrides }));
      await expect(result).resolves.toMatchObject({ accepted: false });
    };
    await reject(host, {});
    const countdown = nextRound(host, "countdown");
    for (const socket of [host, opponent]) {
      socket.send(JSON.stringify({ type: "round-received", ...ids }));
      socket.send(JSON.stringify({ type: "round-rendered", ...ids }));
    }
    await countdown;
    const active = [nextRound(host, "active"), nextRound(opponent, "active")];
    now += 3000;
    activate();
    await Promise.all(active);
    const before = opponentStates.at(-1)!;
    for (const invalid of [
      { roundId: "wrong" }, { duelId: "wrong" }, { source: target },
      { expectedClicks: 1 }, { destination: secret }, { destination: { ...alias, pageId: 999 } },
      { requestId: "failed", destination: broken },
    ]) await reject(host, invalid);
    const moved = navigationResult(host, "move");
    host.send(JSON.stringify(command));
    await flush(host);
    expect(lookups).toHaveLength(1);
    expect(hostStates.at(-1)!.self.clicks).toBe(0);
    await reject(host, { requestId: "conflict" });
    const changed = [nextRound(host, "active"), nextRound(opponent, "active")];
    lookups[0]!.resolve(destination);
    await expect(moved).resolves.toMatchObject({ accepted: true });
    await Promise.all(changed);
    expect(hostStates.at(-1)!).toMatchObject({ self: { clicks: 1, path: [start.identity, secret] },
      round: { article: destination } });
    expect(opponentStates.at(-1)).toEqual({ ...before, opponent: { ...before.opponent, clicks: 1 } });
    expect(JSON.stringify(opponentStates)).not.toContain(secret.title);
    expect(JSON.stringify(opponentStates)).not.toContain("Private content");
    await reject(host, { source: secret, expectedClicks: 1, destination: target }); // duplicate request ID
    await reject(host, { requestId: "stale", expectedClicks: 1, destination: target });
    expect(lookups).toHaveLength(1);
    const hostResult = nextMessage(host, "navigation-result");
    host.send(JSON.stringify({ ...command, requestId: "host-target", source: secret,
      expectedClicks: 1, destination: target }));
    await flush(host);
    const opponentResult = nextMessage(opponent, "navigation-result");
    opponent.send(JSON.stringify({ ...command, requestId: "opponent-target", destination: target }));
    await flush(opponent);
    expect(lookups).toHaveLength(3);
    const ended = [nextRound(host, "post-round"), nextRound(opponent, "post-round")];
    now += 1500;
    lookups[2]!.resolve({ ...preparedArticle, identity: target });
    const outcomes = await Promise.all(ended);
    await expect(opponentResult).resolves.toMatchObject({ accepted: true });
    lookups[1]!.resolve({ ...preparedArticle, identity: target });
    await expect(hostResult).resolves.toMatchObject({ accepted: false });
    for (const state of outcomes) {
      if (state.phase !== "post-round") throw new Error("Expected Round Outcome");
      expect(state.outcome.winnerId).toBe(duel!.opponent.id);
      expect(state.outcome.players.map((player) => player.clicks)).toEqual([1, 1]);
    }
    await reject(host, { requestId: "late", source: secret, expectedClicks: 1, destination: target });
    expect(hostStates.at(-1)).toEqual(outcomes[0]);
    expect(opponentStates.at(-1)).toEqual(outcomes[1]);
    const rejectReady = async (overrides: object) => {
      const rejected = nextMessage(host, "command-rejected");
      host.send(JSON.stringify({ type: "ready-next-round", ...ids, ...overrides }));
      await expect(rejected).resolves.toMatchObject({ command: "ready-next-round", reason: "invalid-state" });
    };
    for (const invalid of [{ duelId: "wrong" }, { roundId: "stale" }]) await rejectReady(invalid);
    const oneReady = [nextRound(host, "post-round"), nextRound(opponent, "post-round")];
    host.send(JSON.stringify({ type: "ready-next-round", ...ids }));
    const waiting = await Promise.all(oneReady);
    expect(waiting[0]).toMatchObject({ readyPlayerIds: [duel!.self.id] });
    expect(waiting[1]).toMatchObject({ readyPlayerIds: [duel!.self.id] });
    await rejectReady({});
    expect(lookups).toHaveLength(3);
    for (const state of waiting) {
      if (state.phase !== "post-round" || outcomes[0]!.phase !== "post-round") throw new Error("Expected Post-Round");
      expect(state.outcome).toEqual(outcomes[0]!.outcome);
    }
    if (failure === "throw") {
      const rejected = nextMessage(host, "command-rejected");
      host.send(JSON.stringify({ type: "leave-duel", duelId: "wrong" }));
      await expect(rejected).resolves.toMatchObject({ command: "leave-duel", reason: "invalid-state" });
      const left = [nextMessage(host, "duel-forfeited"), nextMessage(opponent, "duel-forfeited")];
      host.send(JSON.stringify({ type: "leave-duel", duelId: duel!.id }));
      for (const notice of await Promise.all(left)) {
        expect(notice).toMatchObject({ duelId: duel!.id, winnerId: duel!.opponent.id, reason: "player-left" });
        expect(decodeServerMessage(notice).ok).toBe(true);
      }
      await rejectReady({});
      return;
    }
    const nextPrepared = [nextRound(host, "preparing"), nextRound(opponent, "preparing")];
    opponent.send(JSON.stringify({ type: "ready-next-round", ...ids }));
    await flush(opponent);
    expect(lookups).toHaveLength(4);
    const nextPrompt = deterministicPromptCatalog.prompts.find((prompt) => prompt.start.title === lookups[3]!.title)!;
    expect(nextPrompt.enabled).toBe(true);
    expect(nextPrompt.id).not.toBe(duel!.round.prompt.id);
    lookups[3]!.resolve({ ...preparedArticle, identity: nextPrompt.start });
    const [nextDuel] = await Promise.all(nextPrepared);
    expect(nextDuel).toMatchObject({ phase: "preparing", round: { number: 2 },
      self: { hp: 75, clicks: 0, path: [nextPrompt.start] }, opponent: { hp: 100, clicks: 0 } });
    await rejectReady({});
    const nextIds = { duelId: nextDuel!.id, roundId: nextDuel!.round.id };
    const secondCountdown = nextRound(host, "countdown");
    for (const socket of [host, opponent]) {
      socket.send(JSON.stringify({ type: "round-received", ...nextIds }));
      socket.send(JSON.stringify({ type: "round-rendered", ...nextIds }));
    }
    await expect(secondCountdown).resolves.toMatchObject({ startsAt: now + 3000 });
  } finally {
    host.terminate(); opponent.terminate(); await app.close();
  }
});

test.each(["start", "deadline"] as const)("prepared Round WebSocket flow: %s", async (ending) => {
  let now = 100_000;
  const timers = new Set<{ at: number; callback: () => void }>();
  const advance = (milliseconds: number) => {
    now += milliseconds;
    for (const timer of timers) if (timer.at <= now) {
      timers.delete(timer);
      timer.callback();
    }
  };
  const app = await buildApp({
    promptRandom: () => 0,
    repository: { getByTitle: async () => ({ ok: true, article: preparedArticle }) },
    now: () => now,
    schedule: (callback, delay) => {
      const timer = { at: now + delay, callback };
      timers.add(timer);
      return () => { timers.delete(timer); };
    },
  });
  await app.ready();
  const host = await app.injectWS("/ws");
  const opponent = await app.injectWS("/ws");
  try {
    const lobby = await createLobby(host);
    await joinLobby(host, opponent, lobby.lobby.code);
    await setReady(host, opponent, true);
    await setReady(opponent, host, true);
    const prepared = [nextRound(host, "preparing"), nextRound(opponent, "preparing")];
    host.send(JSON.stringify({ type: "start-duel" }));
    const [first, second] = await Promise.all(prepared);
    expect(first!.round).toEqual(second!.round);
    expect(first!.round.article).toEqual(preparedArticle);
    const ids = { duelId: first!.id, roundId: first!.round.id };
    const reject = async (socket: WebSocket, message: object) => {
      const rejected = nextMessage(socket, "command-rejected");
      socket.send(JSON.stringify(message));
      await expect(rejected).resolves.toMatchObject({ reason: "invalid-state" });
    };
    await reject(host, { type: "round-rendered", ...ids, roundId: "wrong" });
    const rejectNavigation = async (requestId: string) => {
      const rejected = nextMessage(host, "navigation-result");
      host.send(JSON.stringify({ type: "navigate", ...ids, requestId, destination: first!.round.prompt.target,
        source: preparedArticle.identity, expectedClicks: 0 }));
      await expect(rejected).resolves.toMatchObject({ accepted: false, requestId });
    };
    await rejectNavigation("early");
    host.send(JSON.stringify({ type: "round-received", ...ids }));
    host.send(JSON.stringify({ type: "round-rendered", ...ids }));
    // Ping provides an ordering barrier for commands on each real WebSocket.
    const flush = async (socket: WebSocket) => {
      const pong = nextMessage(socket, "pong");
      socket.send(JSON.stringify({ type: "ping" }));
      await pong;
    };
    await flush(host);
    advance(60_000);
    expect(timers.size).toBe(0);
    opponent.send(JSON.stringify({ type: "round-received", ...ids }));
    await flush(opponent);
    if (ending === "deadline") {
      const interrupted = [nextMessage(host, "duel-interrupted"), nextMessage(opponent, "duel-interrupted")];
      advance(30_000);
      const notices = await Promise.all(interrupted);
      for (const notice of notices) {
        expect(notice).toMatchObject({ reason: "preparation-deadline", duelId: first!.id });
        expect(notice).not.toHaveProperty("winnerId");
      }
      await reject(host, { type: "round-rendered", ...ids });
      const missing = nextMessage(opponent, "lobby-error");
      opponent.send(JSON.stringify({ type: "join-lobby", clientId: "replacement", lobbyCode: lobby.lobby.code }));
      await expect(missing).resolves.toMatchObject({ message: "Lobby not found" });
      const fresh = await createLobby(host, "fresh-host");
      expect(fresh.lobby.members).toHaveLength(1);
    } else {
      const countdown = [nextRound(host, "countdown"), nextRound(opponent, "countdown")];
      opponent.send(JSON.stringify({ type: "round-rendered", ...ids }));
      for (const duel of await Promise.all(countdown)) expect(duel).toMatchObject({ startsAt: 163_000 });
      await reject(host, { type: "round-rendered", ...ids });
      advance(2999);
      await rejectNavigation("still-early");
      const active = [nextRound(host, "active"), nextRound(opponent, "active")];
      advance(1);
      for (const duel of await Promise.all(active)) {
        expect(duel).toMatchObject({ startsAt: 163_000, self: { clicks: 0, path: [preparedArticle.identity] } });
      }
    }
  } finally {
    host.terminate();
    opponent.terminate();
    await app.close();
  }
  expect(timers.size).toBe(0);
});

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

type DuelStateMessage = {
  type: "duel-state";
  duel: PreparingDuelProjection;
};

type CommandRejectedMessage = {
  type: "command-rejected";
  command: "start-duel" | "set-ready" | "leave-lobby";
  reason: StartDuelRejectionReason;
};

type DuelForfeitedMessage = {
  type: "duel-forfeited";
  duelId: string;
  winnerId: string;
  reason: "player-disconnected";
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

test("responses permit only the approved Wikimedia image origins", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/health" });

  const policy = response.headers["content-security-policy"];
  expect(policy).toContain("img-src 'self' https://upload.wikimedia.org");
  expect(policy).toContain("https://thumb.wikimedia.org");
  expect(policy).not.toContain("img-src *");
  expect(policy).not.toMatch(/img-src[^;]*\shttps:(?:\s|;|$)/);

  await app.close();
});

test("a ready Host starts one player-private Duel and disconnect forfeits it once", async () => {
  const app = await buildApp({
    promptCatalog: deterministicPromptCatalog,
    createDuelId: () => "duel-1",
    repository: { getByTitle: async () => ({ ok: true, article: preparedArticle }) },
    promptRandom: () => 0,
  });
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

  const hostDuelStatePromise = nextMessage<DuelStateMessage>(hostSocket, "duel-state");
  const opponentDuelStatePromise = nextMessage<DuelStateMessage>(opponentSocket, "duel-state");
  const repeatedStartRejection = nextMessage<CommandRejectedMessage>(
    hostSocket,
    "command-rejected",
  );
  hostSocket.send(JSON.stringify({ type: "start-duel" }));
  hostSocket.send(JSON.stringify({ type: "start-duel" }));
  const [hostDuelState, opponentDuelState] = await Promise.all([
    hostDuelStatePromise,
    opponentDuelStatePromise,
  ]);
  await expect(repeatedStartRejection).resolves.toMatchObject({
    command: "start-duel",
    reason: "invalid-state",
  });

  expect(hostDuelState.duel).toMatchObject({
    id: "duel-1",
    phase: "preparing",
    round: { number: 1, prompt: { id: "fixture-first" } },
    self: { id: "host-id", hp: 100, clicks: 0 },
    opponent: { id: "opponent-id", hp: 100 },
  });
  expect(hostDuelState.duel.self.path).toEqual([
    { pageId: 1001, title: "Fixture Start One" },
  ]);
  expect(hostDuelState.duel.opponent).not.toHaveProperty("path");
  expect(hostDuelState.duel.opponent).toMatchObject({ clicks: 0, connected: true });
  expect(opponentDuelState.duel.self.id).toBe("opponent-id");
  expect(opponentDuelState.duel.opponent.id).toBe("host-id");
  expect(opponentDuelState.duel.opponent).not.toHaveProperty("path");

  const invalidStateRejection = nextMessage<CommandRejectedMessage>(
    hostSocket,
    "command-rejected",
  );
  hostSocket.send(JSON.stringify({ type: "set-ready", ready: false }));
  await expect(invalidStateRejection).resolves.toMatchObject({
    command: "set-ready",
    reason: "invalid-state",
  });

  const invalidLeaveRejection = nextMessage<CommandRejectedMessage>(
    hostSocket,
    "command-rejected",
  );
  hostSocket.send(JSON.stringify({ type: "leave-lobby" }));
  await expect(invalidLeaveRejection).resolves.toMatchObject({
    command: "leave-lobby",
    reason: "invalid-state",
  });

  const forfeits: DuelForfeitedMessage[] = [];
  hostSocket.on("message", (data) => {
    const message = JSON.parse(data.toString()) as ServerMessage;
    if (message.type === "duel-forfeited") forfeits.push(message as DuelForfeitedMessage);
  });
  const forfeitedPromise = nextMessage<DuelForfeitedMessage>(hostSocket, "duel-forfeited");
  opponentSocket.terminate();
  await expect(forfeitedPromise).resolves.toMatchObject({
    duelId: "duel-1",
    winnerId: "host-id",
    reason: "player-disconnected",
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(forfeits).toHaveLength(1);

  const replacementSocket = await app.injectWS("/ws");
  const missingLobby = nextMessage<LobbyErrorMessage>(replacementSocket, "lobby-error");
  replacementSocket.send(JSON.stringify({
    type: "join-lobby",
    clientId: "replacement-id",
    lobbyCode: createdLobby.lobby.code,
  }));
  await expect(missingLobby).resolves.toMatchObject({ message: "Lobby not found" });

  replacementSocket.terminate();
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

  const malformedObjectErrorPromise = nextMessage<LobbyErrorMessage>(
    unpairedSocket,
    "lobby-error",
  );
  unpairedSocket.send(JSON.stringify({ type: "ping", unexpected: true }));
  await expect(malformedObjectErrorPromise).resolves.toMatchObject({ message: "Invalid message" });

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

  const malformedStartError = nextMessage<LobbyErrorMessage>(hostSocket, "lobby-error");
  hostSocket.send(JSON.stringify({ type: "start-duel", unexpected: true }));
  await expect(malformedStartError).resolves.toMatchObject({ message: "Invalid message" });

  const notReadyRejection = nextMessage<CommandRejectedMessage>(hostSocket, "command-rejected");
  hostSocket.send(JSON.stringify({ type: "start-duel" }));
  await expect(notReadyRejection).resolves.toMatchObject({ reason: "players-not-ready" });

  const hostReadyState = await setReady(hostSocket, opponentSocket, true);
  expect(hostReadyState.lobby.members.find(({ role }) => role === "host")?.ready).toBe(true);
  const bothReadyState = await setReady(opponentSocket, hostSocket, true);
  expect(bothReadyState.lobby.members.find(({ role }) => role === "opponent")?.ready).toBe(true);

  const notHostRejection = nextMessage<CommandRejectedMessage>(opponentSocket, "command-rejected");
  opponentSocket.send(JSON.stringify({ type: "start-duel" }));
  await expect(notHostRejection).resolves.toMatchObject({ reason: "not-host" });

  const hostDuelState = nextMessage(hostSocket, "duel-state");
  const opponentDuelState = nextMessage(opponentSocket, "duel-state");
  hostSocket.send(JSON.stringify({ type: "start-duel" }));
  await Promise.all([hostDuelState, opponentDuelState]);

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


test.each(["rematch", "host-back", "opponent-back"])("completes a multi-round Duel and repeats play via %s", async (choice) => {
  let now = 100_000;
  let activate = () => {};
  const app = await buildApp({ promptRandom: () => 0, now: () => now,
    schedule: (callback, delay) => { if (delay === 3000) activate = callback; return () => {}; },
    repository: { getByTitle: async (title) => {
      const prompt = deterministicPromptCatalog.prompts.find((entry) => entry.start.title === title);
      const identity = prompt?.start ?? deterministicPromptCatalog.prompts.find((entry) => entry.target.title === title)!.target;
      return { ok: true, article: { ...preparedArticle, identity, document: { ...preparedArticle.document,
        blocks: prompt ? [{ type: "paragraph", children: [{ type: "navigation", destination: prompt.target,
          children: [{ type: "text", value: "Target" }] }] }] : [],
      } } };
    } },
  });
  await app.ready();
  const host = await app.injectWS("/ws");
  const opponent = await app.injectWS("/ws");
  try {
    const lobby = await createLobby(host);
    await joinLobby(host, opponent, lobby.lobby.code);
    await setReady(host, opponent, true);
    await setReady(opponent, host, true);
    let prepared = nextRound(host, "preparing");
    host.send(JSON.stringify({ type: "start-duel" }));
    let final: DuelProjection | undefined;
    const prompts: string[] = [];
    for (let round = 1; round <= 5; round++) {
      const duel = await prepared;
      prompts.push(duel.round.prompt.id);
      const ids = { duelId: duel.id, roundId: duel.round.id };
      const countdown = nextRound(host, "countdown");
      for (const socket of [host, opponent]) {
        socket.send(JSON.stringify({ type: "round-received", ...ids }));
        socket.send(JSON.stringify({ type: "round-rendered", ...ids }));
      }
      await countdown;
      const active = nextRound(host, "active");
      now += 3000;
      activate();
      await active;
      const ended = nextRound(host, round === 5 ? "completed" : "post-round");
      host.send(JSON.stringify({ type: "navigate", ...ids, requestId: `arrival-${round}`,
        source: duel.round.prompt.start, destination: duel.round.prompt.target, expectedClicks: 0 }));
      final = await ended;
      if (round < 5) {
        prepared = nextRound(host, "preparing");
        for (const socket of [host, opponent]) socket.send(JSON.stringify({ type: "ready-next-round", ...ids }));
      }
    }
    expect(final).toMatchObject({ phase: "completed", self: { hp: 100 }, opponent: { hp: 0 } });
    const ids = { duelId: final!.id, roundId: final!.round.id };
    const continued = [nextRound(host, "post-duel"), nextRound(opponent, "completed")];
    host.send(JSON.stringify({ type: "continue-post-duel", ...ids }));
    const [summary, comparison] = await Promise.all(continued);
    expect(summary).toMatchObject({ summary: { winnerId: final!.self.id, endReason: "hp-depleted",
      rounds: [1, 2, 3, 4, 5].map((roundNumber) => ({ roundNumber, damage: 22 })) } });
    expect(comparison).toMatchObject({ phase: "completed", outcome: { final: true } });
    for (const command of [
      { type: "continue-post-duel", ...ids }, { type: "ready-next-round", ...ids },
      { type: "round-rendered", ...ids }, { type: "start-duel" },
      { type: "continue-post-duel", ...ids, roundId: "stale" },
    ]) {
      const rejected = nextMessage(host, "command-rejected");
      host.send(JSON.stringify(command));
      await expect(rejected).resolves.toMatchObject({ command: command.type, reason: "invalid-state" });
    }
    const late = navigationResult(host, "late");
    host.send(JSON.stringify({ type: "navigate", ...ids, requestId: "late",
      source: final!.round.prompt.target, destination: final!.round.prompt.start, expectedClicks: 1 }));
    await expect(late).resolves.toEqual(expect.objectContaining({ accepted: false }));
    const other = nextRound(opponent, "post-duel");
    opponent.send(JSON.stringify({ type: "continue-post-duel", ...ids }));
    expect(await other).toMatchObject({ phase: "post-duel", summary: summary!.phase === "post-duel" ? summary!.summary : null });
    const intent = [nextRound(host, "post-duel"), nextRound(opponent, "post-duel")];
    host.send(JSON.stringify({ type: "request-rematch", ...ids }));
    for (const projection of await Promise.all(intent)) {
      expect(projection).toMatchObject({ id: ids.duelId, rematchPlayerIds: [final!.self.id] });
    }
    if (choice === "rematch") {
      const fresh = [nextRound(host, "preparing"), nextRound(opponent, "preparing")];
      const stale = nextMessage(opponent, "command-rejected");
      // Same-socket ordering guarantees the second intent commits before Back arrives.
      opponent.send(JSON.stringify({ type: "request-rematch", ...ids }));
      opponent.send(JSON.stringify({ type: "back-to-lobby", ...ids }));
      await expect(stale).resolves.toMatchObject({ command: "back-to-lobby", reason: "invalid-state" });
      const rematches = await Promise.all(fresh);
      expect(rematches[0]!.id).not.toBe(ids.duelId);
      expect(rematches[1]!.id).toBe(rematches[0]!.id);
      for (const duel of rematches) {
        expect(duel).toMatchObject({ phase: "preparing", round: { number: 1 }, self: { hp: 100, clicks: 0 }, opponent: { hp: 100, clicks: 0 } });
        expect(duel.round.prompt.id).toBe("fixture-third");
      }
      expect(prompts).toEqual(["fixture-first", "fixture-second", "fixture-third", "fixture-first", "fixture-second"]);
    } else {
      const actor = choice === "host-back" ? host : opponent;
      const restored = [nextMessage<LobbyStateMessage>(host, "lobby-state"), nextMessage<LobbyStateMessage>(opponent, "lobby-state")];
      const stale = nextMessage(actor, "command-rejected");
      actor.send(JSON.stringify({ type: "back-to-lobby", ...ids }));
      actor.send(JSON.stringify({ type: "request-rematch", ...ids }));
      const states = await Promise.all(restored);
      expect(states[0]!.lobby).toEqual(states[1]!.lobby);
      expect(states[0]!.lobby).toMatchObject({ code: lobby.lobby.code, members: [{ ready: false }, { ready: false }] });
      await expect(stale).resolves.toMatchObject({ command: "request-rematch", reason: "invalid-state" });
      let rejected = nextMessage(host, "command-rejected");
      host.send(JSON.stringify({ type: "start-duel" }));
      await expect(rejected).resolves.toMatchObject({ reason: "players-not-ready" });
      await setReady(host, opponent, true);
      await setReady(opponent, host, true);
      rejected = nextMessage(opponent, "command-rejected");
      opponent.send(JSON.stringify({ type: "start-duel" }));
      await expect(rejected).resolves.toMatchObject({ reason: "not-host" });
      const fresh = [nextRound(host, "preparing"), nextRound(opponent, "preparing")];
      host.send(JSON.stringify({ type: "start-duel" }));
      for (const duel of await Promise.all(fresh)) {
        expect(duel.id).not.toBe(ids.duelId);
        expect(duel).toMatchObject({ round: { number: 1, prompt: { id: "fixture-third" } }, self: { hp: 100 }, opponent: { hp: 100 } });
      }
    }
  } finally {
    host.terminate(); opponent.terminate(); await app.close();
  }
});
