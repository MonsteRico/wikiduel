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
        code: "ABCDE",
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
        round: {
          number: 1,
          prompt: {
            id: "prompt-1",
            start: { pageId: 1, title: "Start" },
            target: { pageId: 2, title: "Target" },
          },
        },
        self: {
          id: "player-1",
          name: "host",
          role: "host",
          hp: 100,
          path: [{ pageId: 1, title: "Start" }],
          clicks: 0,
        },
        opponent: {
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
        code: "ABCDE",
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
        round: {
          number: 1,
          prompt: {
            id: "prompt-1",
            start: { pageId: 1, title: "Start" },
            target: { pageId: 2, title: "Target" },
          },
        },
        self: {
          id: "player-1",
          name: "host",
          role: "host",
          hp: 100,
          path: [{ pageId: 1, title: "Start" }],
          clicks: 0,
        },
        opponent: {
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
      lobby: { code: "ABCDE", members: [], unexpected: true },
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
