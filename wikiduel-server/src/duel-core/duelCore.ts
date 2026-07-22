import { randomUUID } from "node:crypto";

import type {
  PreparingDuelProjection,
  StartDuelRejectionReason,
} from "@wikiduel/contracts";

import type { Prompt, PromptCatalog } from "../prompt-catalog/catalog.js";
import {
  EMPTY_LOBBY_PROMPT_HISTORY,
  type LobbyPromptHistory,
  selectLobbyPrompt,
} from "../prompt-catalog/selector.js";

export type DuelLobbyPlayer = Readonly<{
  id: string;
  name: string;
  role: "host" | "opponent";
  connected: boolean;
  ready: boolean;
}>;

export type StartDuelCommand = Readonly<{
  lobbyId: string;
  actorId: string;
  players: readonly DuelLobbyPlayer[];
}>;

export type DuelProjectionEnvelope = Readonly<{
  recipientId: string;
  duel: PreparingDuelProjection;
}>;

export type StartDuelResult =
  | Readonly<{ ok: true; projections: readonly DuelProjectionEnvelope[] }>
  | Readonly<{
      ok: false;
      rejection: Readonly<{
        command: "start-duel";
        reason: StartDuelRejectionReason;
      }>;
    }>;

export type CreateDuelCoreOptions = Readonly<{
  promptCatalog: PromptCatalog;
  random?: () => number;
  createDuelId?: () => string;
}>;

export type DisconnectPlayerCommand = Readonly<{
  lobbyId: string;
  playerId: string;
}>;

export type DuelForfeit = Readonly<{
  duelId: string;
  winnerId: string;
  reason: "player-disconnected";
}>;

type DuelPlayerState = Readonly<{
  id: string;
  name: string;
  role: "host" | "opponent";
  hp: number;
  path: readonly Prompt["start"][];
  clicks: number;
}>;

type PreparingDuelState = Readonly<{
  id: string;
  phase: "preparing";
  prompt: Prompt;
  players: readonly [DuelPlayerState, DuelPlayerState];
}>;

function rejection(reason: StartDuelRejectionReason): StartDuelResult {
  return { ok: false, rejection: { command: "start-duel", reason } };
}

function projectDuel(
  duel: PreparingDuelState,
  self: DuelPlayerState,
  opponent: DuelPlayerState,
): PreparingDuelProjection {
  return {
    id: duel.id,
    phase: duel.phase,
    round: {
      number: 1,
      prompt: {
        id: duel.prompt.id,
        start: duel.prompt.start,
        target: duel.prompt.target,
      },
    },
    self: {
      id: self.id,
      name: self.name,
      role: self.role,
      hp: self.hp,
      path: self.path,
      clicks: self.clicks,
    },
    opponent: {
      id: opponent.id,
      name: opponent.name,
      role: opponent.role,
      hp: opponent.hp,
    },
  };
}

export function createDuelCore(options: CreateDuelCoreOptions) {
  const duels = new Map<string, PreparingDuelState>();
  const promptHistoryByLobby = new Map<string, LobbyPromptHistory>();
  const createDuelId = options.createDuelId ?? randomUUID;

  return {
    startDuel(command: StartDuelCommand): StartDuelResult {
      if (duels.has(command.lobbyId)) return rejection("invalid-state");

      const actor = command.players.find((player) => player.id === command.actorId);
      if (actor?.role !== "host") return rejection("not-host");
      if (command.players.length !== 2) return rejection("lobby-not-full");
      if (!command.players.every((player) => player.connected && player.ready)) {
        return rejection("players-not-ready");
      }

      const selection = selectLobbyPrompt(
        options.promptCatalog,
        promptHistoryByLobby.get(command.lobbyId) ?? EMPTY_LOBBY_PROMPT_HISTORY,
        { random: options.random },
      );
      const createPlayerState = (player: DuelLobbyPlayer): DuelPlayerState => ({
        id: player.id,
        name: player.name,
        role: player.role,
        hp: 100,
        path: [selection.prompt.start],
        clicks: 0,
      });
      const players: [DuelPlayerState, DuelPlayerState] = [
        createPlayerState(command.players[0]!),
        createPlayerState(command.players[1]!),
      ];
      const duel: PreparingDuelState = {
        id: createDuelId(),
        phase: "preparing",
        prompt: selection.prompt,
        players,
      };

      duels.set(command.lobbyId, duel);
      promptHistoryByLobby.set(command.lobbyId, selection.history);

      return {
        ok: true,
        projections: [
          {
            recipientId: players[0].id,
            duel: projectDuel(duel, players[0], players[1]),
          },
          {
            recipientId: players[1].id,
            duel: projectDuel(duel, players[1], players[0]),
          },
        ],
      };
    },

    getLobbyPromptHistory(lobbyId: string): LobbyPromptHistory {
      return promptHistoryByLobby.get(lobbyId) ?? EMPTY_LOBBY_PROMPT_HISTORY;
    },

    hasActiveDuel(lobbyId: string): boolean {
      return duels.has(lobbyId);
    },

    disbandLobby(lobbyId: string): void {
      duels.delete(lobbyId);
      promptHistoryByLobby.delete(lobbyId);
    },

    disconnectPlayer(command: DisconnectPlayerCommand): DuelForfeit | null {
      const duel = duels.get(command.lobbyId);
      if (!duel || !duel.players.some((player) => player.id === command.playerId)) return null;

      const winner = duel.players.find((player) => player.id !== command.playerId);
      if (!winner) return null;

      duels.delete(command.lobbyId);
      promptHistoryByLobby.delete(command.lobbyId);
      return {
        duelId: duel.id,
        winnerId: winner.id,
        reason: "player-disconnected",
      };
    },
  };
}

export type DuelCore = ReturnType<typeof createDuelCore>;
