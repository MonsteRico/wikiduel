import { randomUUID } from "node:crypto";

import type {
  DuelProjection,
  PlayableArticle,
  StartDuelRejectionReason,
} from "@wikiduel/contracts";

import type { Prompt, PromptCatalog } from "../prompt-catalog/catalog.js";
import type { PlayableArticleRepository } from "../playable-articles/repository.js";
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
  duel: DuelProjection;
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
  repository?: PlayableArticleRepository;
  now?: () => number;
  schedule?: (callback: () => void, delayMs: number) => () => void;
  onEvent?: (lobbyId: string, event: DuelEvent) => void;
}>;

export type DuelEvent =
  | Readonly<{ type: "projections"; projections: readonly DuelProjectionEnvelope[] }>
  | Readonly<{ type: "interruption"; duelId: string; reason: "preparation-deadline" | "article-unavailable" }>;

export type RoundCommand = Readonly<{
  lobbyId: string; duelId: string; roundId: string; playerId: string;
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

type DuelState = {
  id: string;
  phase: "preparing" | "countdown" | "active";
  roundId: string;
  roundNumber: number;
  article?: PlayableArticle;
  loading: boolean;
  received: Set<string>;
  rendered: Set<string>;
  deadline?: number;
  startsAt?: number;
  cancelTimer?: () => void;
  prompt: Prompt;
  players: readonly [DuelPlayerState, DuelPlayerState];
};

function rejection(reason: StartDuelRejectionReason): StartDuelResult {
  return { ok: false, rejection: { command: "start-duel", reason } };
}

function projectDuel(
  duel: DuelState,
  self: DuelPlayerState,
  opponent: DuelPlayerState,
  serverNow: number,
): DuelProjection {
  const projection = {
    id: duel.id,
    serverNow,
    round: {
      id: duel.roundId,
      number: duel.roundNumber,
      ...(duel.article ? { article: duel.article } : {}),
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
  return duel.phase === "preparing"
    ? { ...projection, phase: "preparing" }
    : { ...projection, phase: duel.phase, startsAt: duel.startsAt!,
        round: { ...projection.round, article: duel.article! } };
}

export function createDuelCore(options: CreateDuelCoreOptions) {
  const duels = new Map<string, DuelState>();
  const promptHistoryByLobby = new Map<string, LobbyPromptHistory>();
  const createDuelId = options.createDuelId ?? randomUUID;
  const now = options.now ?? Date.now;
  const schedule = options.schedule ?? ((callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  });
  const projections = (duel: DuelState): readonly DuelProjectionEnvelope[] => {
    const serverNow = now();
    return duel.players.map((self, index) => ({
      recipientId: self.id,
      duel: projectDuel(duel, self, duel.players[index === 0 ? 1 : 0], serverNow),
    }));
  };
  const publish = (lobbyId: string, duel: DuelState) => {
    options.onEvent?.(lobbyId, { type: "projections", projections: projections(duel) });
  };
  const disband = (lobbyId: string) => {
    duels.get(lobbyId)?.cancelTimer?.();
    duels.delete(lobbyId);
    promptHistoryByLobby.delete(lobbyId);
  };
  const interrupt = (lobbyId: string, duel: DuelState, reason: "preparation-deadline" | "article-unavailable") => {
    if (duels.get(lobbyId) !== duel) return;
    disband(lobbyId);
    options.onEvent?.(lobbyId, { type: "interruption", duelId: duel.id, reason });
  };
  const currentRound = (command: RoundCommand) => {
    const duel = duels.get(command.lobbyId);
    return duel?.id === command.duelId && duel.roundId === command.roundId
      && duel.players.some((player) => player.id === command.playerId) ? duel : undefined;
  };

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
      const duel: DuelState = {
        id: createDuelId(),
        phase: "preparing",
        roundId: randomUUID(), roundNumber: 1, loading: false,
        received: new Set(), rendered: new Set(),
        prompt: selection.prompt,
        players,
      };

      duels.set(command.lobbyId, duel);
      promptHistoryByLobby.set(command.lobbyId, selection.history);

      return {
        ok: true,
        projections: projections(duel),
      };
    },

    // Internal lifecycle entry point, reused by later Post-Round and Rematch transitions.
    async prepareRound(lobbyId: string): Promise<void> {
      const duel = duels.get(lobbyId);
      if (!duel || duel.loading || duel.phase === "countdown"
        || (duel.phase === "preparing" && duel.article)) return;
      if (duel.phase === "active") {
        const selection = selectLobbyPrompt(options.promptCatalog,
          promptHistoryByLobby.get(lobbyId) ?? EMPTY_LOBBY_PROMPT_HISTORY,
          { random: options.random });
        duel.prompt = selection.prompt;
        promptHistoryByLobby.set(lobbyId, selection.history);
        duel.roundNumber += 1;
        duel.roundId = randomUUID();
        duel.phase = "preparing";
        duel.article = undefined;
        duel.startsAt = undefined;
        duel.deadline = undefined;
        duel.received.clear();
        duel.rendered.clear();
        const resetPlayer = (player: DuelPlayerState): DuelPlayerState => ({ ...player,
          path: [duel.prompt.start], clicks: 0,
        });
        duel.players = [resetPlayer(duel.players[0]), resetPlayer(duel.players[1])];
        publish(lobbyId, duel);
      }
      duel.loading = true;
      try {
        const result = await options.repository?.getByTitle(duel.prompt.start.title);
        if (duels.get(lobbyId) !== duel) return;
        if (!result?.ok || result.article.identity.pageId !== duel.prompt.start.pageId
          || result.article.identity.title !== duel.prompt.start.title) {
          interrupt(lobbyId, duel, "article-unavailable");
          return;
        }
        duel.article = result.article;
        duel.loading = false;
        publish(lobbyId, duel);
      } catch {
        interrupt(lobbyId, duel, "article-unavailable");
      }
    },

    acknowledgeRound(command: RoundCommand & { kind: "received" | "rendered" }): boolean {
      const duel = currentRound(command);
      if (!duel || duel.phase !== "preparing" || !duel.article) return false;
      if (duel.deadline !== undefined && now() >= duel.deadline) {
        interrupt(command.lobbyId, duel, "preparation-deadline");
        return false;
      }
      const acknowledgements = command.kind === "received" ? duel.received : duel.rendered;
      if (acknowledgements.has(command.playerId)
        || (command.kind === "rendered" && !duel.received.has(command.playerId))) return false;
      acknowledgements.add(command.playerId);
      if (duel.received.size === 2 && duel.deadline === undefined) {
        duel.deadline = now() + 30_000;
        duel.cancelTimer = schedule(() => interrupt(command.lobbyId, duel, "preparation-deadline"), 30_000);
      }
      if (duel.rendered.size === 2 && duel.received.size === 2) {
        duel.cancelTimer?.();
        duel.phase = "countdown";
        duel.startsAt = now() + 3_000;
        publish(command.lobbyId, duel);
        duel.cancelTimer = schedule(() => {
          if (duels.get(command.lobbyId) !== duel || duel.phase !== "countdown") return;
          duel.phase = "active";
          publish(command.lobbyId, duel);
        }, 3_000);
      }
      return true;
    },

    canNavigate(command: RoundCommand): boolean {
      const duel = currentRound(command);
      return !!duel && duel.startsAt !== undefined && now() >= duel.startsAt;
    },

    dispose(): void {
      for (const lobbyId of duels.keys()) disband(lobbyId);
    },

    getLobbyPromptHistory(lobbyId: string): LobbyPromptHistory {
      return promptHistoryByLobby.get(lobbyId) ?? EMPTY_LOBBY_PROMPT_HISTORY;
    },

    hasActiveDuel(lobbyId: string): boolean {
      return duels.has(lobbyId);
    },

    disbandLobby(lobbyId: string): void {
      disband(lobbyId);
    },

    disconnectPlayer(command: DisconnectPlayerCommand): DuelForfeit | null {
      const duel = duels.get(command.lobbyId);
      if (!duel || !duel.players.some((player) => player.id === command.playerId)) return null;

      const winner = duel.players.find((player) => player.id !== command.playerId);
      if (!winner) return null;

      disband(command.lobbyId);
      return {
        duelId: duel.id,
        winnerId: winner.id,
        reason: "player-disconnected",
      };
    },
  };
}

export type DuelCore = ReturnType<typeof createDuelCore>;
