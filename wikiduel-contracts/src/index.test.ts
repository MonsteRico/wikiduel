import { describe, expect, it } from "vitest";

import { decodeClientMessage, decodeServerMessage } from "./index.js";

const article = {
  identity: { pageId: 42, title: "Douglas Adams" },
  revision: { id: 101, timestamp: "2026-07-13T12:00:00Z" },
  attribution: {
    sourceUrl: "https://en.wikipedia.org/wiki/Douglas_Adams",
    historyUrl: "https://en.wikipedia.org/w/index.php?title=Douglas_Adams&action=history",
    licenseName: "Creative Commons Attribution-ShareAlike 4.0 International",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    modificationNotice: "Adapted for Wiki Duel.",
  },
  document: {
    title: "Douglas Adams",
    tableOfContents: [],
    blocks: [],
  },
} as const;

describe("Round preparation contracts", () => {
  it("requires source and click version for Navigation and correlates its result", () => {
    const command = { type: "navigate", duelId: "duel", roundId: "round", requestId: "request",
      source: article.identity, destination: article.identity, expectedClicks: 2 };
    for (const patch of [{ source: undefined }, { expectedClicks: undefined }, { expectedClicks: -1 }, { expectedClicks: 0.5 }]) {
      expect(decodeClientMessage({ ...command, ...patch }).ok).toBe(false);
    }
    const result = { type: "navigation-result", duelId: "duel", roundId: "round", requestId: "request",
      accepted: false, sentAt: "now" };
    expect(decodeServerMessage(result).ok).toBe(true);
    expect(decodeServerMessage({ ...result, requestId: undefined }).ok).toBe(false);
  });
  it.each(["round-received", "round-rendered", "navigate"])("decodes strict %s commands", (type) => {
    const command = { type, duelId: "duel-1", roundId: "round-1",
      ...(type === "navigate" ? { requestId: "request-1", destination: article.identity,
        source: article.identity, expectedClicks: 0 } : {}),
    };
    expect(decodeClientMessage(command)).toEqual({ ok: true, message: command });
    expect(decodeClientMessage({ ...command, roundId: "" }).ok).toBe(false);
    expect(decodeClientMessage({ ...command, playerId: "spoofed" }).ok).toBe(false);
  });

  it("requires article content and an authoritative timestamp for timed phases", () => {
    const player = { id: "host", name: "Host", role: "host", hp: 100 };
    const message = {
      type: "duel-state", sentAt: "2026-10-01T00:00:00Z",
      duel: {
        id: "duel-1", phase: "countdown", serverNow: 100_000, expiresAt: null, startsAt: 103_000,
        round: { id: "round-1", number: 1, article, prompt: {
          id: "prompt-1", start: article.identity, target: { pageId: 99, title: "Target" },
        } },
        self: { arrived: false, arrivalElapsedMs: null, ...player, path: [article.identity], clicks: 0 },
        opponent: { arrived: false, ...player, id: "opponent", role: "opponent", clicks: 0, connected: true },
      },
    };
    expect(decodeServerMessage(message).ok).toBe(true);
    for (const privateField of ["article", "currentArticle", "path", "distance", "estimatedDistance", "arrivalElapsedMs", "arrivalOrder"]) {
      expect(decodeServerMessage({ ...message, duel: { ...message.duel,
        opponent: { ...message.duel.opponent, [privateField]: article },
      } }).ok).toBe(false);
    }
    expect(decodeServerMessage({ ...message, duel: { ...message.duel, phase: "active" } }).ok).toBe(true);
    expect(decodeServerMessage({ ...message, duel: { ...message.duel, startsAt: undefined } }).ok).toBe(false);
    expect(decodeServerMessage({ ...message, duel: { ...message.duel,
      round: { ...message.duel.round, article: undefined },
    } }).ok).toBe(false);
  });

  it("does not permit a winner in an Interruption notice", () => {
    const message = { type: "duel-interrupted", duelId: "duel-1",
      reason: "preparation-deadline", message: "Round preparation expired.",
      sentAt: "2026-10-01T00:00:00Z",
    };
    expect(decodeServerMessage(message).ok).toBe(true);
    expect(decodeServerMessage({ ...message, winnerId: "host" }).ok).toBe(false);
  });
});

const emptyOmission = { count: 0, reasons: [], examples: [] } as const;
const diagnostics = {
  requestedTitle: "Douglas Adams",
  wikipediaUrl: article.attribution.sourceUrl,
  canonicalIdentity: article.identity,
  revision: article.revision,
  durationMs: 12,
  cacheOutcome: "miss",
  emittedNodeCounts: {
    headings: 0,
    paragraphs: 0,
    lists: 0,
    listItems: 0,
    figures: 0,
    text: 0,
    strong: 0,
    emphasis: 0,
    navigation: 0,
  },
  omissions: {
    structure: emptyOmission,
    links: emptyOmission,
    images: emptyOmission,
    imageAttribution: emptyOmission,
  },
  retry: { attempts: 0 },
} as const;

const sentAt = "2026-07-13T12:00:01Z";

describe("decodeClientMessage", () => {
  it.each([
    { type: "ping" },
    { type: "create-lobby", clientId: "player-1" },
    { type: "join-lobby", clientId: "player-2", lobbyCode: "ABCDE" },
    { type: "set-ready", ready: true },
    { type: "start-duel" },
    { type: "leave-lobby" },
    {
      type: "preview-article",
      requestId: "request-1",
      requestedTitle: "Douglas Adams",
    },
  ])("decodes a valid $type message", (message) => {
    expect(decodeClientMessage(message)).toEqual({ ok: true, message });
  });

  it.each([
    { type: "unknown-message" },
    { type: "create-lobby" },
    { type: "set-ready", ready: "yes" },
    { type: "start-duel", unexpected: true },
    { type: "ping", unexpected: true },
  ])("rejects a malformed client message", (message) => {
    expect(decodeClientMessage(message)).toEqual({
      ok: false,
      failure: { code: "malformed-message" },
    });
  });
});

describe("decodeServerMessage", () => {
  it.each([
    { type: "welcome", message: "Connected", sentAt },
    { type: "pong", message: "Pong", sentAt },
    {
      type: "lobby-state",
      lobby: {
        code: "ABCDE", timeLimitEnabled: false,
        members: [{
          id: "player-1",
          name: "host",
          role: "host",
          connected: true,
          ready: false,
        }],
      },
      sentAt,
    },
    { type: "lobby-error", message: "Lobby not found", sentAt },
    { type: "lobby-closed", message: "The other player left.", sentAt },
    {
      type: "duel-state",
      duel: {
        id: "duel-1",
        phase: "preparing",
        serverNow: 100_000,
        round: {
          id: "round-1",
          number: 1,
          prompt: {
            id: "prompt-1",
            start: { pageId: 1, title: "Start" },
            target: { pageId: 2, title: "Target" },
          },
        },
        self: { arrived: false, arrivalElapsedMs: null,
          id: "player-1",
          name: "host",
          role: "host",
          hp: 100,
          path: [{ pageId: 1, title: "Start" }],
          clicks: 0,
        },
        opponent: { arrived: false,
          clicks: 0, connected: true,
          id: "player-2",
          name: "Opponent",
          role: "opponent",
          hp: 100,
        },
      },
      sentAt,
    },
    {
      type: "command-rejected",
      command: "start-duel",
      reason: "players-not-ready",
      sentAt,
    },
    {
      type: "command-rejected",
      command: "leave-lobby",
      reason: "invalid-state",
      sentAt,
    },
    {
      type: "duel-forfeited",
      duelId: "duel-1",
      winnerId: "player-1",
      reason: "player-disconnected",
      message: "Your opponent disconnected. The duel ended by Forfeit.",
      sentAt,
    },
    {
      type: "preview-article-result",
      requestId: "request-1",
      requestedTitle: "Douglas Adams",
      ok: true,
      article,
      diagnostics,
      sentAt,
    },
    {
      type: "preview-article-result",
      requestId: "request-2",
      requestedTitle: "Missing",
      ok: false,
      failure: { code: "article-not-found" },
      diagnostics: { ...diagnostics, requestedTitle: "Missing" },
      sentAt,
    },
    {
      type: "preview-error",
      requestId: "request-3",
      requestedTitle: "Douglas Adams",
      failure: { code: "preview-unavailable" },
      sentAt,
    },
  ])("decodes a valid $type message", (message) => {
    expect(decodeServerMessage(message)).toEqual({ ok: true, message });
  });

  it.each([
    { type: "unknown-message", sentAt },
    { type: "pong", message: "Pong" },
    { type: "lobby-error", message: 404, sentAt },
    {
      type: "lobby-state",
      lobby: {
        code: "ABCDE", timeLimitEnabled: false,
        members: [{
          id: "player-1",
          name: "host",
          role: "spectator",
          connected: true,
          ready: false,
        }],
      },
      sentAt,
    },
    {
      type: "duel-state",
      duel: {
        id: "duel-1",
        phase: "preparing",
        serverNow: 100_000,
        round: {
          id: "round-1",
          number: 1,
          prompt: {
            id: "prompt-1",
            start: { pageId: 1, title: "Start" },
            target: { pageId: 2, title: "Target" },
          },
        },
        self: { arrived: false, arrivalElapsedMs: null,
          id: "player-1",
          name: "host",
          role: "host",
          hp: 100,
          path: [{ pageId: 1, title: "Start" }],
          clicks: 0,
        },
        opponent: { arrived: false,
          clicks: 0, connected: true,
          id: "player-2",
          name: "Opponent",
          role: "opponent",
          hp: 100,
          path: [{ pageId: 1, title: "Start" }],
        },
      },
      sentAt,
    },
    {
      type: "lobby-state",
      lobby: { code: "ABCDE", timeLimitEnabled: false, members: [], unexpected: true },
      sentAt,
    },
    {
      type: "preview-article-result",
      requestId: "request-1",
      requestedTitle: "Douglas Adams",
      ok: true,
      diagnostics,
      sentAt,
    },
  ])("rejects a malformed server message", (message) => {
    expect(decodeServerMessage(message)).toEqual({
      ok: false,
      failure: { code: "malformed-message" },
    });
  });
});

it("decodes scoped readiness, continuation and departure commands without client authority fields", () => {
  for (const command of [
    { type: "ready-next-round", duelId: "duel-1", roundId: "round-1" },
    { type: "continue-post-duel", duelId: "duel-1", roundId: "round-1" },
    { type: "request-rematch", duelId: "duel-1", roundId: "round-1" },
    { type: "back-to-lobby", duelId: "duel-1", roundId: "round-1" },
    { type: "leave-duel", duelId: "duel-1" },
  ]) {
    expect(decodeClientMessage(command)).toEqual({ ok: true, message: command });
    expect(decodeClientMessage({ ...command, duelId: "" }).ok).toBe(false);
    expect(decodeClientMessage({ ...command, playerId: "opponent" }).ok).toBe(false);
    if ('roundId' in command) {
      expect(decodeClientMessage({ ...command, roundId: "" }).ok).toBe(false);
      expect(decodeClientMessage({ ...command, roundId: undefined }).ok).toBe(false);
    }
  }
  expect(decodeClientMessage({ type: "ready-next-round", duelId: "duel-1" }).ok).toBe(false);
  expect(decodeClientMessage({ type: "ready-next-round", duelId: "duel-1", roundId: "round-1", ready: false }).ok).toBe(false);
});

it("decodes only strict Round Outcomes in ended projections", () => {
  const player = { id: "host", name: "Host", role: "host", hp: 100 };
  const outcome = {
    roundId: "round-1", roundNumber: 1, endReason: "both-arrived", winReason: "earlier-arrival", winnerId: "host",
    startsAt: 1000, endedAt: 5000, final: false,
    players: [
      { id: "host", path: [article.identity], clicks: 1, activeElapsedMs: 4000, arrived: true, hpLoss: 0, hp: 100 },
      { id: "opponent", path: [article.identity], clicks: 0, activeElapsedMs: 4000, arrived: true, hpLoss: 25, hp: 75 },
    ],
    damage: { kind: "completed-routes", ruleId: "click-scored-v2", winnerClicks: 1, loserClicks: 1, baseDamage: 25, clickDifferential: 0,
      clickMultiplier: 3, multiplierContribution: 0, unclampedDamage: 25,
      minimumDamage: 25, maximumDamage: 60, finalDamage: 25 },
  };
  const duel = {
    id: "duel-1", phase: "post-round", serverNow: 5000, expiresAt: null, startsAt: 1000, readyPlayerIds: [],
    round: { id: "round-1", number: 1, article, prompt: {
      id: "prompt-1", start: article.identity, target: { pageId: 99, title: "Target" },
    } },
    self: { arrived: false, arrivalElapsedMs: null, ...player, path: [article.identity], clicks: 1 },
    opponent: { arrived: false, ...player, id: "opponent", role: "opponent", hp: 78, clicks: 0, connected: true },
    outcome,
  };
  const decode = (value: unknown) => decodeServerMessage({ type: "duel-state", duel: value, sentAt: "now" });
  expect(decode(duel).ok).toBe(true);
  expect(decode({ ...duel, phase: "completed", outcome: { ...outcome, final: true } }).ok).toBe(true);
  for (const invalid of [
    undefined,
    { ...outcome, privateState: {} },
    { ...outcome, players: [outcome.players[0]] },
    { ...outcome, players: [...outcome.players, outcome.players[0]] },
    { ...outcome, players: [{ ...outcome.players[0], hp: -1 }, outcome.players[1]] },
    { ...outcome, players: [{ ...outcome.players[0], activeElapsedMs: -1 }, outcome.players[1]] },
    { ...outcome, players: [{ ...outcome.players[0], clicks: 1.5 }, outcome.players[1]] },
    { ...outcome, damage: { ...outcome.damage, finalDamage: -1 } },
    { ...outcome, damage: { ...outcome.damage, hiddenRule: 1 } },
    { ...outcome, endReason: "time-limit" },
  ]) expect(decode({ ...duel, outcome: invalid }).ok).toBe(false);
  expect(decode({ ...duel, phase: "active" }).ok).toBe(false);
  expect(decodeClientMessage({ type: "end-round", outcome }).ok).toBe(false);
  const timeout = { ...outcome, endReason: "time-limit", winReason: "sole-arrival",
    players: [outcome.players[0], { ...outcome.players[1], arrived: false }],
    damage: { kind: "sole-arrival", ruleId: "click-scored-v2", finalDamage: 60 } };
  const draw = { ...timeout, winnerId: null, winReason: "neither-arrived", final: false,
    players: outcome.players.map((player) => ({ ...player, arrived: false, hp: 100, hpLoss: 0 })),
    damage: { kind: "draw", ruleId: "click-scored-v2", finalDamage: 0 } };
  expect(decode({ ...duel, outcome: timeout }).ok).toBe(true);
  expect(decode({ ...duel, outcome: draw }).ok).toBe(true);
  for (const invalid of [
    { ...timeout, damage: { ...timeout.damage, clickDifferential: 1 } },
    { ...timeout, damage: { ...timeout.damage, finalDamage: 25 } },
    { ...draw, winnerId: "host" }, { ...draw, final: true },
    { ...draw, players: [{ ...draw.players[0], arrived: true }, draw.players[1]] },
    { ...outcome, players: [{ ...outcome.players[0], arrived: false }, outcome.players[1]] },
  ]) expect(decode({ ...duel, outcome: invalid }).ok).toBe(false);
});

it("accepts only boolean Time Limit settings without client authority", () => {
  for (const enabled of [true, false]) expect(decodeClientMessage({ type: "set-time-limit", enabled }).ok).toBe(true);
  for (const enabled of [null, undefined, 300, "true"]) expect(decodeClientMessage({ type: "set-time-limit", enabled }).ok).toBe(false);
  expect(decodeClientMessage({ type: "set-time-limit", enabled: true, playerId: "host" }).ok).toBe(false);
});


it("decodes only strict normal Post-Duel summaries and scoped continuation", () => {
  const players = [{ id: "host", name: "Host", role: "host", hp: 100 },
    { id: "opponent", name: "Opponent", role: "opponent", hp: 0 }];
  const summary = { winnerId: "host", endReason: "hp-depleted", players,
    rounds: [{ roundId: "round-5", roundNumber: 5, winnerId: "host", winReason: "fewer-clicks", damage: 22 }] };
  const duel = { id: "duel-1", phase: "post-duel", rematchPlayerIds: [], serverNow: 5000, expiresAt: null, startsAt: 1000,
    round: { id: "round-5", number: 5, article, prompt: {
      id: "prompt-1", start: article.identity, target: { pageId: 99, title: "Target" },
    } },
    self: { arrived: false, arrivalElapsedMs: null, ...players[0], path: [article.identity], clicks: 1 },
    opponent: { arrived: false, ...players[1], clicks: 0, connected: true }, summary,
  };
  const decode = (value: unknown) => decodeServerMessage({ type: "duel-state", duel: value, sentAt: "now" });
  expect(decode(duel).ok).toBe(true);
  expect(decode({ ...duel, rematchPlayerIds: ["host"] }).ok).toBe(true);
  for (const rematchPlayerIds of [undefined, [""], [1], ["host", "opponent", "third"], "host"]) {
    expect(decode({ ...duel, rematchPlayerIds }).ok).toBe(false);
  }
  for (const invalid of [undefined, { ...summary, endReason: "forfeit" }, { ...summary, endReason: "interruption" },
    { ...summary, privateState: {} }, { ...summary, players: [players[0]] },
    { ...summary, players: [{ ...players[0], hp: -1 }, players[1]] }, { ...summary, rounds: [] },
    { ...summary, rounds: [{ ...summary.rounds[0], damage: -1 }] },
    { ...summary, rounds: [{ ...summary.rounds[0], privateState: {} }] },
  ]) expect(decode({ ...duel, summary: invalid }).ok).toBe(false);
  for (const extra of [{ playerId: "opponent" }, { hp: 100 }, { summary }, { roundId: "" }]) {
    expect(decodeClientMessage({ type: "continue-post-duel", duelId: "duel-1", roundId: "round-5", ...extra }).ok).toBe(false);
  }
  expect(decodeClientMessage({ type: "continue-post-duel", duelId: "duel-1" }).ok).toBe(false);
});
