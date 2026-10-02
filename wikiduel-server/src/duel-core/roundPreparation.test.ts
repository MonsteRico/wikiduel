import { afterEach, expect, it, vi } from "vitest";
import { preparedArticle as article } from "./fixtures.js";
import { deterministicPromptCatalog } from "../prompt-catalog/fixtures.js";
import { createDuelCore, type DuelEvent } from "./duelCore.js";

const players = [
  { id: "host", name: "Host", role: "host", connected: true, ready: true },
  { id: "opponent", name: "Opponent", role: "opponent", connected: true, ready: true },
] as const;


afterEach(() => vi.useRealTimers());

it("waits for both covered renders, then activates at one shared start time", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  const events: DuelEvent[] = [];
  const core = createDuelCore({
    promptCatalog: deterministicPromptCatalog, random: () => 0,
    repository: { getByTitle: async () => ({ ok: true, article }) },
    now: () => Date.now(), onEvent: (_lobbyId, event) => events.push(event),
  });
  core.startDuel({ lobbyId: "lobby", actorId: "host", players });
  await core.prepareRound("lobby");
  const prepared = events.at(-1)!;
  if (prepared.type !== "projections") throw new Error("Expected prepared Round");
  const duel = prepared.projections[0]!.duel;
  expect(prepared.projections[1]!.duel.round).toEqual(duel.round);
  expect(duel.round.article).toEqual(article);
  const command = { lobbyId: "lobby", duelId: duel.id, roundId: duel.round.id };
  core.acknowledgeRound({ ...command, playerId: "host", kind: "received" });
  core.acknowledgeRound({ ...command, playerId: "opponent", kind: "received" });
  core.acknowledgeRound({ ...command, playerId: "host", kind: "rendered" });
  expect(core.checkNavigationEligibility({ ...command, playerId: "host" })).toBe(false);
  expect(events).toHaveLength(1);
  core.acknowledgeRound({ ...command, playerId: "opponent", kind: "rendered" });
  expect(events.at(-1)).toMatchObject({ type: "projections", projections: [
    { duel: { phase: "countdown", startsAt: 103_000 } },
    { duel: { phase: "countdown", startsAt: 103_000 } },
  ] });
  vi.advanceTimersByTime(2999);
  expect(core.checkNavigationEligibility({ ...command, playerId: "host" })).toBe(false);
  expect(events).toHaveLength(2);
  vi.advanceTimersByTime(1);
  expect(core.checkNavigationEligibility({ ...command, playerId: "host" })).toBe(true);
  expect(events.at(-1)).toMatchObject({ type: "projections", projections: [
    { duel: { phase: "active", startsAt: 103_000 } },
    { duel: { phase: "active", startsAt: 103_000 } },
  ] });
});

async function preparedRound() {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  const events: DuelEvent[] = [];
  const core = createDuelCore({
    promptCatalog: deterministicPromptCatalog, random: () => 0,
    repository: { getByTitle: async (title) => ({ ok: true, article: {
      ...article, identity: title === article.identity.title ? article.identity
        : { pageId: 1005, title },
    } }) },
    now: () => Date.now(), onEvent: (_lobby, event) => events.push(event),
  });
  core.startDuel({ lobbyId: "lobby", actorId: "host", players });
  await core.prepareRound("lobby");
  const event = events.at(-1)!;
  if (event.type !== "projections") throw new Error("Expected prepared Round");
  const duel = event.projections[0]!.duel;
  return { core, events, command: { lobbyId: "lobby", duelId: duel.id, roundId: duel.round.id } };
}

it("starts the fixed deadline only after both receipts, ignores wrong and duplicate acknowledgements", async () => {
  const { core, events, command } = await preparedRound();
  expect(core.acknowledgeRound({ ...command, playerId: "outsider", kind: "received" })).toBe(false);
  expect(core.acknowledgeRound({ ...command, roundId: "stale", playerId: "host", kind: "received" })).toBe(false);
  expect(core.acknowledgeRound({ ...command, duelId: "wrong", playerId: "host", kind: "received" })).toBe(false);
  expect(core.acknowledgeRound({ ...command, playerId: "host", kind: "rendered" })).toBe(false);
  core.acknowledgeRound({ ...command, playerId: "host", kind: "received" });
  vi.advanceTimersByTime(60_000);
  expect(events).toHaveLength(1);
  core.acknowledgeRound({ ...command, playerId: "host", kind: "rendered" });
  core.acknowledgeRound({ ...command, playerId: "opponent", kind: "received" });
  vi.advanceTimersByTime(29_999);
  expect(core.acknowledgeRound({ ...command, playerId: "host", kind: "rendered" })).toBe(false);
  expect(events).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(events.at(-1)).toEqual({ type: "interruption", duelId: command.duelId, reason: "preparation-deadline" });
  expect(core.hasActiveDuel("lobby")).toBe(false);
  expect(core.getLobbyPromptHistory("lobby")).toEqual({ usedPromptIds: [] });
  expect(core.acknowledgeRound({ ...command, playerId: "opponent", kind: "rendered" })).toBe(false);
  expect(core.disconnectPlayer({ lobbyId: "lobby", playerId: "host" })).toBeNull();
  vi.advanceTimersByTime(60_000);
  expect(events).toHaveLength(2);
});

it("rejects a late render even if the deadline timer has not run", async () => {
  const { core, events, command } = await preparedRound();
  for (const playerId of ["host", "opponent"]) core.acknowledgeRound({ ...command, playerId, kind: "received" });
  core.acknowledgeRound({ ...command, playerId: "host", kind: "rendered" });
  vi.setSystemTime(130_000);
  expect(core.acknowledgeRound({ ...command, playerId: "opponent", kind: "rendered" })).toBe(false);
  expect(events.at(-1)).toMatchObject({ type: "interruption", reason: "preparation-deadline" });
});

it("reuses preparation for a later Round and rejects acknowledgements from the previous Round", async () => {
  const { core, events, command } = await preparedRound();
  for (const playerId of ["host", "opponent"]) {
    core.acknowledgeRound({ ...command, playerId, kind: "received" });
    core.acknowledgeRound({ ...command, playerId, kind: "rendered" });
  }
  vi.advanceTimersByTime(3000);
  const active = events.at(-1)!;
  if (active.type !== "projections") throw new Error("Expected active Round");
  core.recordNavigation({ ...command, playerId: "host", expectedClicks: 0,
    destination: active.projections[0]!.duel.round.prompt.target });
  core.recordNavigation({ ...command, playerId: "opponent", expectedClicks: 0, destination: active.projections[0]!.duel.round.prompt.target });
  for (const playerId of ["host", "opponent"]) core.readyForNextRound({ ...command, playerId });
  await core.prepareRound("lobby");
  const event = events.at(-1)!;
  if (event.type !== "projections") throw new Error("Expected second Round");
  const duel = event.projections[0]!.duel;
  expect(duel.phase).toBe("preparing");
  expect(duel.round.number).toBe(2);
  expect(duel.round.id).not.toBe(command.roundId);
  expect(duel.self).toMatchObject({ hp: 100, clicks: 0, path: [duel.round.prompt.start] });
  expect(core.checkNavigationEligibility({ ...command, roundId: duel.round.id, playerId: "host" })).toBe(false);
  expect(core.acknowledgeRound({ ...command, playerId: "host", kind: "rendered" })).toBe(false);
  for (const playerId of ["host", "opponent"]) {
    core.acknowledgeRound({ ...command, roundId: duel.round.id, playerId, kind: "received" });
    core.acknowledgeRound({ ...command, roundId: duel.round.id, playerId, kind: "rendered" });
  }
  vi.advanceTimersByTime(3000);
  expect(events.at(-1)).toMatchObject({ type: "projections", projections: [
    { duel: { phase: "active", startsAt: 106_000 } },
    { duel: { phase: "active", startsAt: 106_000 } },
  ] });
});

it("cancels a pending start when a player disconnects", async () => {
  const { core, events, command } = await preparedRound();
  for (const playerId of ["host", "opponent"]) {
    core.acknowledgeRound({ ...command, playerId, kind: "received" });
    core.acknowledgeRound({ ...command, playerId, kind: "rendered" });
  }
  expect(core.disconnectPlayer({ lobbyId: "lobby", playerId: "host" })).toMatchObject({ winnerId: "opponent" });
  vi.advanceTimersByTime(60_000);
  expect(events).toHaveLength(2);
});

it("does not publish a delayed article after the Lobby is disbanded", async () => {
  const events: DuelEvent[] = [];
  let resolveArticle!: (result: { ok: true; article: typeof article }) => void;
  const core = createDuelCore({
    promptCatalog: deterministicPromptCatalog, random: () => 0,
    repository: { getByTitle: () => new Promise((resolve) => { resolveArticle = resolve; }) },
    onEvent: (_lobby, event) => events.push(event),
  });
  core.startDuel({ lobbyId: "lobby", actorId: "host", players });
  const preparing = core.prepareRound("lobby");
  core.disbandLobby("lobby");
  resolveArticle({ ok: true, article });
  await preparing;
  expect(events).toEqual([]);
});

it.each(["failure", "wrong-article", "throw"])("interrupts when article preparation returns %s", async (failure) => {
  const events: DuelEvent[] = [];
  const core = createDuelCore({
    promptCatalog: deterministicPromptCatalog, random: () => 0,
    repository: { getByTitle: async () => {
      if (failure === "throw") throw new Error("Upstream failed");
      return failure === "failure"
        ? { ok: false, failure: { code: "upstream-unavailable" } }
        : { ok: true, article: { ...article, identity: { pageId: 99, title: "Wrong" } } };
    } },
    onEvent: (_lobby, event) => events.push(event),
  });
  core.startDuel({ lobbyId: "lobby", actorId: "host", players });
  await core.prepareRound("lobby");
  expect(events).toEqual([{ type: "interruption", duelId: expect.any(String), reason: "article-unavailable" }]);
  expect(core.hasActiveDuel("lobby")).toBe(false);
});
