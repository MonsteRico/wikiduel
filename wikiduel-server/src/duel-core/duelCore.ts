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
  timeLimitEnabled?: boolean;
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
  article?: PlayableArticle;
  navigating?: boolean;
  requests: Set<string>;
  arrival?: Readonly<{ elapsedMs: number; order: number }>;
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
  outcomes: RoundOutcome[];
  continued: Set<string>;
  rematch: Set<string>;
  roundId: string;
  roundNumber: number;
  article?: PlayableArticle;
  loading: boolean;
  received: Set<string>;
  rendered: Set<string>;
  ready: Set<string>;
  deadline?: number;
  timeLimitEnabled: boolean;
  expiresAt: number | null;
  arrivalCount: number;
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
      arrived: !!self.arrival,
      arrivalElapsedMs: self.arrival?.elapsedMs ?? null,
    },
    opponent: {
      id: opponent.id,
      name: opponent.name,
      role: opponent.role,
      hp: opponent.hp,
      clicks: opponent.clicks,
      arrived: !!opponent.arrival,
      connected: true,
    },
  };
  if (duel.phase === "completed" && duel.continued.has(self.id)) {
    const identity = (player: DuelPlayerState) => ({ id: player.id, name: player.name, role: player.role, hp: player.hp });
    return { ...projection, phase: "post-duel", startsAt: duel.startsAt!, expiresAt: duel.expiresAt,
      rematchPlayerIds: [...duel.rematch],
      round: { ...projection.round, article: article! },
      summary: {
        winnerId: duel.outcome!.winnerId!, endReason: "hp-depleted",
        players: [identity(duel.players[0]), identity(duel.players[1])],
        rounds: duel.outcomes.map((outcome) => ({ roundId: outcome.roundId,
          roundNumber: outcome.roundNumber, winnerId: outcome.winnerId, winReason: outcome.winReason, damage: outcome.damage.finalDamage })),
      },
    };
  }
  if (duel.phase === "post-round" || duel.phase === "completed") {
    return { ...projection, phase: duel.phase, startsAt: duel.startsAt!, expiresAt: duel.expiresAt,
      round: { ...projection.round, article: article! }, outcome: duel.outcome!, readyPlayerIds: [...duel.ready] };
  }
  return duel.phase === "preparing"
    ? { ...projection, phase: "preparing" }
    : { ...projection, phase: duel.phase, startsAt: duel.startsAt!, expiresAt: duel.expiresAt,
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

  const isNavigable = (duel: DuelState, at = now()) =>
    (duel.phase === "active" || duel.phase === "countdown")
    && duel.startsAt !== undefined && at >= duel.startsAt;

  const finishRound = (lobbyId: string, duel: DuelState, endedAt: number) => {
    if (duel.outcome) return;
    const arrivals = duel.players.filter((player) => player.arrival);
    const winner = arrivals.length === 2
      ? [...arrivals].sort((a, b) => a.clicks - b.clicks || a.arrival!.order - b.arrival!.order)[0]
      : arrivals[0];
    const loser = winner && duel.players.find((player) => player.id !== winner.id)!;
    const damage = arrivals.length === 2
      ? calculateDamage({ kind: "completed-routes", winnerClicks: winner!.clicks, loserClicks: loser!.clicks })
      : calculateDamage({ kind: winner ? "sole-arrival" : "draw" });
    const freezePlayer = (player: DuelPlayerState) => {
      const hpLoss = player.id === loser?.id ? Math.min(player.hp, damage.finalDamage) : 0;
      return Object.freeze({ id: player.id,
        path: Object.freeze(player.path.map((article) => Object.freeze({ ...article }))),
        clicks: player.clicks, arrived: !!player.arrival,
        activeElapsedMs: player.arrival?.elapsedMs ?? endedAt - duel.startsAt!,
        hp: player.hp - hpLoss, hpLoss });
    };
    const players = Object.freeze([freezePlayer(duel.players[0]), freezePlayer(duel.players[1])] as const);
    const common = { roundId: duel.roundId, roundNumber: duel.roundNumber,
      startsAt: duel.startsAt!, endedAt, players };
    const final = players.some((player) => player.hp === 0);
    const outcome: RoundOutcome = Object.freeze(damage.kind === "completed-routes"
      ? { ...common, endReason: "both-arrived", winReason: winner!.clicks === loser!.clicks ? "earlier-arrival" : "fewer-clicks",
          winnerId: winner!.id, damage, final }
      : damage.kind === "sole-arrival"
        ? { ...common, endReason: "time-limit", winReason: "sole-arrival", winnerId: winner!.id, damage, final }
        : { ...common, endReason: "time-limit", winReason: "neither-arrived", winnerId: null, damage, final: false });
    duel.players = [{ ...duel.players[0], hp: players[0].hp, navigating: false },
      { ...duel.players[1], hp: players[1].hp, navigating: false }];
    duel.outcome = outcome;
    duel.outcomes.push(outcome);
    duel.phase = outcome.final ? "completed" : "post-round";
    duel.cancelTimer?.();
    publish(lobbyId, duel);
  };
  const expireIfDue = (lobbyId: string, duel: DuelState, at = now()) => {
    if (!isNavigable(duel, at) || duel.expiresAt === null || at < duel.expiresAt) return false;
    finishRound(lobbyId, duel, duel.expiresAt);
    return true;
  };
  const acceptNavigation = (command: RoundCommand, duel: DuelState, index: 0 | 1,
    destination: NavigationDestination, article?: PlayableArticle) => {
    const acceptedAt = now();
    if (expireIfDue(command.lobbyId, duel, acceptedAt) || !isNavigable(duel, acceptedAt)
      || duel.players[index].arrival) return false;
    commitNavigation(duel, index, destination, article);
    duel.phase = "active";
    if (destination.pageId === duel.prompt.target.pageId && destination.title === duel.prompt.target.title) {
      const player = { ...duel.players[index], arrival: { elapsedMs: acceptedAt - duel.startsAt!, order: ++duel.arrivalCount } };
      duel.players = index === 0 ? [player, duel.players[1]] : [duel.players[0], player];
    }
    if (duel.arrivalCount === 2) finishRound(command.lobbyId, duel, acceptedAt);
    else publish(command.lobbyId, duel);
    return true;
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
        requests: new Set(),
      });
      const players: [DuelPlayerState, DuelPlayerState] = [
        createPlayerState(command.players[0]!),
        createPlayerState(command.players[1]!),
      ];
      const duel: DuelState = {
        id: createDuelId(),
        phase: "preparing",
        timeLimitEnabled: command.timeLimitEnabled ?? false, expiresAt: null, arrivalCount: 0,
        roundId: randomUUID(), roundNumber: 1, loading: false,
        received: new Set(), rendered: new Set(), ready: new Set(),
        outcomes: [], continued: new Set(), rematch: new Set(),
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
        || (duel.phase === "post-round" && duel.ready.size !== 2)
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
        duel.expiresAt = null;
        duel.arrivalCount = 0;
        duel.received.clear();
        duel.rendered.clear();
        duel.ready.clear();
        const resetPlayer = (player: DuelPlayerState): DuelPlayerState => ({ ...player,
          path: [duel.prompt.start], clicks: 0, article: undefined, navigating: false, requests: new Set(), arrival: undefined,
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

    continueToPostDuel(command: RoundCommand): boolean {
      const duel = currentRound(command);
      if (!duel || duel.phase !== "completed" || duel.continued.has(command.playerId)) return false;
      duel.continued.add(command.playerId);
      publish(command.lobbyId, duel);
      return true;
    },

    requestRematch(command: RoundCommand): boolean {
      const duel = currentRound(command);
      if (!duel || duel.phase !== "completed" || !duel.continued.has(command.playerId)
        || duel.rematch.has(command.playerId)) return false;
      duel.rematch.add(command.playerId);
      if (duel.rematch.size === 2) {
        duel.cancelTimer?.();
        duels.delete(command.lobbyId);
        const result = this.startDuel({ lobbyId: command.lobbyId,
          timeLimitEnabled: duel.timeLimitEnabled,
          actorId: duel.players.find((player) => player.role === "host")!.id,
          players: duel.players.map((player) => ({ ...player, connected: true, ready: true })),
        });
        if (result.ok) options.onEvent?.(command.lobbyId, { type: "projections", projections: result.projections });
      } else publish(command.lobbyId, duel);
      return true;
    },

    backToLobby(command: RoundCommand): boolean {
      const duel = currentRound(command);
      if (!duel || duel.phase !== "completed" || !duel.continued.has(command.playerId)) return false;
      duel.cancelTimer?.();
      duels.delete(command.lobbyId);
      return true;
    },

    readyForNextRound(command: RoundCommand): boolean {
      const duel = currentRound(command);
      if (!duel || duel.phase !== "post-round" || duel.outcome?.final || duel.ready.has(command.playerId)) return false;
      duel.ready.add(command.playerId);
      publish(command.lobbyId, duel);
      return true;
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
        duel.cancelTimer = schedule(() => {
          if (currentRound(command) === duel && duel.phase === "preparing") interrupt(command.lobbyId, duel, "preparation-deadline");
        }, 30_000);
      }
      if (duel.rendered.size === 2 && duel.received.size === 2) {
        duel.cancelTimer?.();
        duel.phase = "countdown";
        duel.startsAt = now() + 3_000;
        duel.expiresAt = duel.timeLimitEnabled ? duel.startsAt + 300_000 : null;
        publish(command.lobbyId, duel);
        duel.cancelTimer = schedule(() => {
          if (currentRound(command) !== duel || !isNavigable(duel)) return;
          if (expireIfDue(command.lobbyId, duel)) return;
          if (duel.phase === "countdown") { duel.phase = "active"; publish(command.lobbyId, duel); }
          if (duel.expiresAt !== null) duel.cancelTimer = schedule(() => {
            if (currentRound(command) === duel) expireIfDue(command.lobbyId, duel);
          }, Math.max(0, duel.expiresAt - now()));
        }, 3_000);
      }
      return true;
    },

    canNavigate(command: RoundCommand): boolean {
      const duel = currentRound(command);
      return !!duel && !expireIfDue(command.lobbyId, duel) && isNavigable(duel)
        && !duel.players.find((player) => player.id === command.playerId)!.arrival;
    },

    async navigate(command: RoundCommand & {
      requestId: string; source: NavigationDestination; expectedClicks: number;
      destination: NavigationDestination;
    }): Promise<boolean> {
      const duel = currentRound(command);
      if (!duel || !this.canNavigate(command)) return false;
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
        if (currentRound(command) !== duel || !this.canNavigate(command) || !result?.ok
          || duel.players[index] !== pending) return false;
        return acceptNavigation(command, duel, index, result.article.identity, result.article);
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
      if (!duel || !this.canNavigate(command)) return false;
      const index = duel.players[0].id === command.playerId ? 0 : 1;
      const player = duel.players[index];
      if (player.clicks !== command.expectedClicks) return false;
      return acceptNavigation(command, duel, index, command.destination);
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

    leaveDuel(command: DisconnectPlayerCommand & { duelId: string }) {
      const duel = duels.get(command.lobbyId);
      if (duel?.id !== command.duelId || !duel.players.some((player) => player.id === command.playerId)) return null;
      if (duel.phase === "completed") {
        disband(command.lobbyId);
        return { type: "lobby-closed" as const };
      }
      const forfeit = this.disconnectPlayer(command);
      return forfeit ? { type: "duel-forfeited" as const, ...forfeit, reason: "player-left" as const } : null;
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
