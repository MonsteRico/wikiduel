import { randomUUID } from "node:crypto";

import type {
  ArticleBlock,
  ArticleInline,
  DuelProjection,
  NavigationDestination,
  RoundOutcome,
  PlayableArticle,
  StartDuelRejectionReason,
} from "@wikiduel/contracts";

import { calculateDamage } from "./damageRule.js";

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

// Server-only cause. Future end causes extend this union and the outcome resolver.
export type RoundEndCause = Readonly<{ type: "target-arrival" }>;
export type EndRoundResult =
  | Readonly<{ ok: true; outcome: RoundOutcome }>
  | Readonly<{ ok: false }>;

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
  article?: PlayableArticle;
  navigating?: boolean;
  requests: Set<string>;
}>;

function hasDestination(blocks: readonly ArticleBlock[], destination: NavigationDestination): boolean {
  const inlineHas = (nodes: readonly ArticleInline[]): boolean => nodes.some((node) =>
    (node.type === "navigation" && node.destination.pageId === destination.pageId
      && node.destination.title === destination.title)
    || ("children" in node && inlineHas(node.children)));
  return blocks.some((block) => {
    switch (block.type) {
      case "heading": case "paragraph": case "line": return inlineHas(block.children);
      case "figure": return inlineHas(block.caption);
      case "list": return block.items.some((item) => inlineHas(item.children) || hasDestination(item.blocks, destination));
      case "infobox": return inlineHas(block.title ?? []) || block.sections.some((section) =>
        inlineHas(section.label ?? []) || section.items.some((item) =>
          inlineHas(item.label ?? []) || hasDestination(item.blocks, destination)));
      case "media-placeholder": return false;
    }
  });
}

type DuelState = {
  id: string;
  phase: "preparing" | "countdown" | "active" | "post-round" | "completed";
  outcome?: RoundOutcome;
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

function commitNavigation(
  duel: DuelState, index: 0 | 1, destination: NavigationDestination, article?: PlayableArticle,
): void {
  const player = duel.players[index];
  const updated = { ...player, navigating: false, article: article ?? player.article,
    clicks: player.clicks + 1, path: [...player.path, Object.freeze({ ...destination })] };
  duel.players = index === 0 ? [updated, duel.players[1]] : [duel.players[0], updated];
}

function rejection(reason: StartDuelRejectionReason): StartDuelResult {
  return { ok: false, rejection: { command: "start-duel", reason } };
}

function projectDuel(
  duel: DuelState,
  self: DuelPlayerState,
  opponent: DuelPlayerState,
  serverNow: number,
): DuelProjection {
  const article = self.article ?? duel.article;
  const projection = {
    id: duel.id,
    serverNow,
    round: {
      id: duel.roundId,
      number: duel.roundNumber,
      ...(article ? { article } : {}),
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
      path: Object.freeze(self.path.map((article) => Object.freeze({ ...article }))),
      clicks: self.clicks,
    },
    opponent: {
      id: opponent.id,
      name: opponent.name,
      role: opponent.role,
      hp: opponent.hp,
      clicks: opponent.clicks,
      connected: true,
    },
  };
  if (duel.phase === "post-round" || duel.phase === "completed") {
    return { ...projection, phase: duel.phase, startsAt: duel.startsAt!,
      round: { ...projection.round, article: article! }, outcome: duel.outcome! };
  }
  return duel.phase === "preparing"
    ? { ...projection, phase: "preparing" }
    : { ...projection, phase: duel.phase, startsAt: duel.startsAt!,
        round: { ...projection.round, article: article! } };
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

  const isNavigable = (duel: DuelState) =>
    (duel.phase === "active" || duel.phase === "countdown")
    && duel.startsAt !== undefined && now() >= duel.startsAt;

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
        requests: new Set(),
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
      if (!duel || duel.loading || duel.phase === "countdown" || duel.phase === "active" || duel.phase === "completed"
        || (duel.phase === "preparing" && duel.article)) return;
      if (duel.phase === "post-round") {
        duel.outcome = undefined;
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
          path: [duel.prompt.start], clicks: 0, article: undefined, navigating: false, requests: new Set(),
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
      return !!duel && isNavigable(duel);
    },

    async navigate(command: RoundCommand & {
      requestId: string; source: NavigationDestination; expectedClicks: number;
      destination: NavigationDestination;
    }): Promise<boolean> {
      const duel = currentRound(command);
      if (!duel || !isNavigable(duel)) return false;
      const index = duel.players[0].id === command.playerId ? 0 : 1;
      const player = duel.players[index];
      const article = player.article ?? duel.article;
      if (player.navigating || player.requests.has(command.requestId) || !article
        || player.clicks !== command.expectedClicks
        || article.identity.pageId !== command.source.pageId || article.identity.title !== command.source.title
        || !hasDestination(article.document.blocks, command.destination)) return false;
      player.requests.add(command.requestId);
      const pending = { ...player, navigating: true };
      duel.players = index === 0 ? [pending, duel.players[1]] : [duel.players[0], pending];
      try {
        const result = await options.repository?.getByTitle(command.destination.title);
        if (!result?.ok || currentRound(command) !== duel || !isNavigable(duel)
          || duel.players[index] !== pending) return false;
        commitNavigation(duel, index, result.article.identity, result.article);
        duel.phase = "active";
        if (result.article.identity.pageId === duel.prompt.target.pageId
          && result.article.identity.title === duel.prompt.target.title) {
          this.endRound({ ...command, cause: { type: "target-arrival" } });
        } else publish(command.lobbyId, duel);
        return true;
      } catch {
        return false;
      } finally {
        if (duel.players[index] === pending) {
          const released = { ...pending, navigating: false };
          duel.players = index === 0 ? [released, duel.players[1]] : [duel.players[0], released];
        }
      }
    },

    // Server-only commit of a canonical move already validated by Navigation.
    // expectedClicks must come from the server snapshot taken before resolving the move.
    // No transport handler may forward unvalidated client destinations here.
    recordNavigation(command: RoundCommand & {
      expectedClicks: number; destination: NavigationDestination;
    }): boolean {
      const duel = currentRound(command);
      if (!duel || !isNavigable(duel)) return false;
      const index = duel.players[0].id === command.playerId ? 0 : 1;
      const player = duel.players[index];
      if (player.clicks !== command.expectedClicks) return false;
      commitNavigation(duel, index, command.destination);
      return true;
    },

    // Synchronous so the first accepted cause freezes state before another command runs.
    endRound(command: RoundCommand & { cause: RoundEndCause }): EndRoundResult {
      const duel = currentRound(command);
      if (!duel || !isNavigable(duel)) return { ok: false };
      const endedAt = now();
      const winner = duel.players.find((player) => player.id === command.playerId)!;
      const arrival = winner.path.at(-1)!;
      if (command.cause.type !== "target-arrival" || winner.clicks === 0
        || arrival.pageId !== duel.prompt.target.pageId
        || arrival.title !== duel.prompt.target.title) return { ok: false };
      const loser = duel.players.find((player) => player.id !== winner.id)!;
      const freezePlayer = (player: DuelPlayerState) => Object.freeze({
        id: player.id,
        path: Object.freeze(player.path.map((article) => Object.freeze({ ...article }))),
        clicks: player.clicks,
        activeElapsedMs: endedAt - duel.startsAt!,
        hp: player.hp,
      });
      const frozen = [freezePlayer(duel.players[0]), freezePlayer(duel.players[1])] as const;
      const damage = calculateDamage({
        winnerClicks: frozen.find((player) => player.id === winner.id)!.clicks,
        loserClicks: frozen.find((player) => player.id === loser.id)!.clicks,
      });
      const resultingPlayer = (player: RoundOutcome["players"][number]) => Object.freeze({
        ...player, hp: player.id === loser.id ? Math.max(0, player.hp - damage.finalDamage) : player.hp,
      });
      const players = Object.freeze([resultingPlayer(frozen[0]), resultingPlayer(frozen[1])] as const);
      const outcome: RoundOutcome = Object.freeze({
        roundId: duel.roundId, roundNumber: duel.roundNumber,
        endReason: command.cause.type, winnerId: winner.id,
        startsAt: duel.startsAt!, endedAt, players, damage,
        final: players.some((player) => player.hp === 0),
      });
      duel.players = [{ ...duel.players[0], hp: players[0].hp }, { ...duel.players[1], hp: players[1].hp }];
      duel.outcome = outcome;
      duel.phase = outcome.final ? "completed" : "post-round";
      duel.cancelTimer?.();
      publish(command.lobbyId, duel);
      return { ok: true, outcome };
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
