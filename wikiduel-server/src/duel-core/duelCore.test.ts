import { describe, expect, it, vi } from "vitest";

import { deterministicPromptCatalog } from "../prompt-catalog/fixtures.js";
import { createDuelCore } from "./duelCore.js";

const readyPlayers = [
  { id: "host-id", name: "host", role: "host", connected: true, ready: true },
  {
    id: "opponent-id",
    name: "Opponent",
    role: "opponent",
    connected: true,
    ready: true,
  },
] as const;

describe("Duel core", () => {
  it("starts Round one for a ready Lobby and reserves its Prompt", () => {
    const core = createDuelCore({
      promptCatalog: deterministicPromptCatalog,
      random: () => 0,
      createDuelId: () => "duel-1",
    });

    const result = core.startDuel({
      lobbyId: "ABCDE",
      actorId: "host-id",
      players: readyPlayers,
    });

    expect(result).toEqual({
      ok: true,
      projections: [
        {
          recipientId: "host-id",
          duel: {
            id: "duel-1",
            phase: "preparing",
            round: {
              number: 1,
              prompt: {
                id: "fixture-first",
                start: { pageId: 1001, title: "Fixture Start One" },
                target: { pageId: 1002, title: "Fixture Target One" },
              },
            },
            self: {
              id: "host-id",
              name: "host",
              role: "host",
              hp: 100,
              path: [{ pageId: 1001, title: "Fixture Start One" }],
              clicks: 0,
            },
            opponent: {
              id: "opponent-id",
              name: "Opponent",
              role: "opponent",
              hp: 100,
            },
          },
        },
        {
          recipientId: "opponent-id",
          duel: {
            id: "duel-1",
            phase: "preparing",
            round: {
              number: 1,
              prompt: {
                id: "fixture-first",
                start: { pageId: 1001, title: "Fixture Start One" },
                target: { pageId: 1002, title: "Fixture Target One" },
              },
            },
            self: {
              id: "opponent-id",
              name: "Opponent",
              role: "opponent",
              hp: 100,
              path: [{ pageId: 1001, title: "Fixture Start One" }],
              clicks: 0,
            },
            opponent: {
              id: "host-id",
              name: "host",
              role: "host",
              hp: 100,
            },
          },
        },
      ],
    });
    expect(core.getLobbyPromptHistory("ABCDE")).toEqual({
      usedPromptIds: ["fixture-first"],
    });
  });

  it.each([
    {
      name: "the Opponent starts",
      actorId: "opponent-id",
      players: readyPlayers,
      reason: "not-host",
    },
    {
      name: "the Lobby is not full",
      actorId: "host-id",
      players: readyPlayers.slice(0, 1),
      reason: "lobby-not-full",
    },
    {
      name: "a player is not ready",
      actorId: "host-id",
      players: [{ ...readyPlayers[0], ready: false }, readyPlayers[1]],
      reason: "players-not-ready",
    },
  ] as const)("rejects without mutation when $name", ({ actorId, players, reason }) => {
    const core = createDuelCore({
      promptCatalog: deterministicPromptCatalog,
      random: () => 0,
      createDuelId: () => "duel-1",
    });

    expect(core.startDuel({ lobbyId: "ABCDE", actorId, players })).toEqual({
      ok: false,
      rejection: { command: "start-duel", reason },
    });
    expect(core.getLobbyPromptHistory("ABCDE")).toEqual({ usedPromptIds: [] });
    expect(core.startDuel({
      lobbyId: "ABCDE",
      actorId: "host-id",
      players: readyPlayers,
    })).toMatchObject({ ok: true });
  });

  it("creates only one Duel when start is repeated", () => {
    const createDuelId = vi.fn(() => "duel-1");
    const core = createDuelCore({
      promptCatalog: deterministicPromptCatalog,
      random: () => 0,
      createDuelId,
    });
    const command = { lobbyId: "ABCDE", actorId: "host-id", players: readyPlayers };

    expect(core.startDuel(command)).toMatchObject({ ok: true });
    expect(core.startDuel(command)).toEqual({
      ok: false,
      rejection: { command: "start-duel", reason: "invalid-state" },
    });
    expect(createDuelId).toHaveBeenCalledTimes(1);
    expect(core.getLobbyPromptHistory("ABCDE")).toEqual({
      usedPromptIds: ["fixture-first"],
    });
  });

  it("terminates an active Duel by Forfeit exactly once when a player disconnects", () => {
    const core = createDuelCore({
      promptCatalog: deterministicPromptCatalog,
      random: () => 0,
      createDuelId: () => "duel-1",
    });
    core.startDuel({ lobbyId: "ABCDE", actorId: "host-id", players: readyPlayers });

    expect(core.disconnectPlayer({ lobbyId: "ABCDE", playerId: "opponent-id" })).toEqual({
      duelId: "duel-1",
      winnerId: "host-id",
      reason: "player-disconnected",
    });
    expect(core.disconnectPlayer({ lobbyId: "ABCDE", playerId: "opponent-id" })).toBeNull();
  });
});
