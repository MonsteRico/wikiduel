import { afterEach, expect, it, vi } from "vitest";
import { decodeServerMessage } from "@wikiduel/contracts";
import { createDuelCore, type DuelEvent } from "./duelCore.js";
import { preparedArticle } from "./fixtures.js";
import { deterministicPromptCatalog } from "../prompt-catalog/fixtures.js";

const players = [
  { id: "host", name: "Host", role: "host", connected: true, ready: true },
  { id: "opponent", name: "Opponent", role: "opponent", connected: true, ready: true },
] as const;
afterEach(() => vi.useRealTimers());

async function activeRound() {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  const events: DuelEvent[] = [];
  const core = createDuelCore({
    promptCatalog: deterministicPromptCatalog, random: () => 0,
    repository: { getByTitle: async (title) => {
      const prompt = deterministicPromptCatalog.prompts.find((entry) => entry.start.title === title)!;
      return { ok: true, article: { ...preparedArticle, identity: prompt.start } };
    } },
    onEvent: (_lobby, event) => events.push(event),
  });
  core.startDuel({ lobbyId: "lobby", actorId: "host", players });
  const latest = () => {
    const event = events.at(-1)!;
    if (event.type !== "projections") throw new Error("Expected projections");
    return event.projections;
  };
  const activate = async () => {
    const previous = events.at(-1);
    if (previous?.type === "projections" && previous.projections[0]!.duel.phase === "post-round") {
      const duel = previous.projections[0]!.duel;
      for (const playerId of ["host", "opponent"]) {
        core.readyForNextRound({ lobbyId: "lobby", duelId: duel.id, roundId: duel.round.id, playerId });
      }
    }
    await core.prepareRound("lobby");
    const duel = latest()[0]!.duel;
    const command = { lobbyId: "lobby", duelId: duel.id, roundId: duel.round.id, playerId: "host" };
    for (const playerId of ["host", "opponent"]) {
      core.acknowledgeRound({ ...command, playerId, kind: "received" });
      core.acknowledgeRound({ ...command, playerId, kind: "rendered" });
    }
    vi.advanceTimersByTime(3000);
    return command;
  };
  const command = await activate();
  return { core, events, latest, activate, command };
}

it("freezes authoritative routes, timing, damage and HP into the same public Round Outcome", async () => {
  const { core, latest, command } = await activeRound();
  const prompt = latest()[0]!.duel.round.prompt;
  expect(latest()[0]!.duel.opponent).not.toHaveProperty("path");
  expect(core.recordNavigation({ ...command, expectedClicks: 0, destination: prompt.target })).toBe(true);
  expect(core.recordNavigation({ ...command, playerId: "opponent", expectedClicks: 0,
    destination: { pageId: 42, title: "Other article" } })).toBe(true);
  vi.advanceTimersByTime(12_345);
  const result = core.endRound({ ...command, cause: { type: "target-arrival" } });
  expect(result).toMatchObject({ ok: true, outcome: {
    roundId: command.roundId, roundNumber: 1, endReason: "target-arrival", winnerId: "host",
    startsAt: 103_000, endedAt: 115_345, final: false,
    players: [
      { id: "host", path: [prompt.start, prompt.target], clicks: 1, activeElapsedMs: 12_345, hp: 100 },
      { id: "opponent", path: [prompt.start, { pageId: 42, title: "Other article" }], clicks: 1, activeElapsedMs: 12_345, hp: 75 },
    ],
    damage: { winnerClicks: 1, loserClicks: 1, baseDamage: 25, clickDifferential: 0,
      clickMultiplier: 3, multiplierContribution: 0, unclampedDamage: 25,
      minimumDamage: 15, maximumDamage: 60, finalDamage: 25 },
  } });
  if (!result.ok) throw new Error("Expected Round Outcome");
  for (const { duel } of latest()) {
    expect(duel).toMatchObject({ phase: "post-round", outcome: result.outcome });
    expect(decodeServerMessage({ type: "duel-state", duel, sentAt: "now" }).ok).toBe(true);
  }
});

it("rejects duplicate arrivals, stale commands and late Navigation without changing the outcome", async () => {
  const { core, latest, command, events } = await activeRound();
  const target = latest()[0]!.duel.round.prompt.target;
  expect(core.endRound({ ...command, cause: { type: "target-arrival" } }).ok).toBe(false);
  expect(core.recordNavigation({ ...command, expectedClicks: 0, destination: target })).toBe(true);
  expect(core.recordNavigation({ ...command, expectedClicks: 0, destination: target })).toBe(false);
  for (const invalid of [{ roundId: "stale" }, { duelId: "stale" }, { playerId: "outsider" }]) {
    expect(core.endRound({ ...command, ...invalid, cause: { type: "target-arrival" } }).ok).toBe(false);
  }
  const result = core.endRound({ ...command, cause: { type: "target-arrival" } });
  if (!result.ok) throw new Error("Expected Round Outcome");
  const saved = structuredClone(result.outcome);
  const eventCount = events.length;
  vi.advanceTimersByTime(1000);
  expect(core.endRound({ ...command, cause: { type: "target-arrival" } }).ok).toBe(false);
  expect(core.endRound({ ...command, playerId: "opponent", cause: { type: "target-arrival" } }).ok).toBe(false);
  expect(core.canNavigate(command)).toBe(false);
  expect(core.recordNavigation({ ...command, expectedClicks: 1, destination: target })).toBe(false);
  expect(events).toHaveLength(eventCount);
  expect(result.outcome).toEqual(saved);
  expect(() => Object.assign(result.outcome.players[0]!.path[0]!, { title: "Changed" })).toThrow();
  expect(() => Object.assign(result.outcome.damage, { finalDamage: 999 })).toThrow();
  expect(() => Object.assign(result.outcome.players[1]!, { hp: 999 })).toThrow();
  expect(() => Object.assign(latest()[0]!.duel.self.path[0]!, { title: "Changed" })).toThrow();
});

it("preserves HP across Rounds, clamps at zero and retains the final Round Outcome", async () => {
  const { core, latest, activate, command: firstCommand } = await activeRound();
  let command = firstCommand;
  const outcomes = [];
  for (const expectedHp of [78, 56, 34, 12, 0]) {
    const target = latest()[0]!.duel.round.prompt.target;
    core.recordNavigation({ ...command, expectedClicks: 0, destination: target });
    vi.advanceTimersByTime(4000);
    const result = core.endRound({ ...command, cause: { type: "target-arrival" } });
    if (!result.ok) throw new Error("Expected Round Outcome");
    outcomes.push(result.outcome);
    expect(result.outcome.players.map((player) => player.hp)).toEqual([100, expectedHp]);
    expect(result.outcome.damage.finalDamage).toBe(22);
    expect(result.outcome.final).toBe(expectedHp === 0);
    expect(result.outcome.players[0]!.activeElapsedMs).toBe(4000);
    expect(latest()[0]!.duel.phase).toBe(expectedHp === 0 ? "completed" : "post-round");
    if (expectedHp > 0) {
      const old = command;
      command = await activate();
      expect(command.roundId).not.toBe(old.roundId);
      expect(core.endRound({ ...old, cause: { type: "target-arrival" } }).ok).toBe(false);
      expect(core.recordNavigation({ ...old, expectedClicks: 0, destination: target })).toBe(false);
      expect(latest()[0]!.duel.self.clicks).toBe(0);
      expect(latest()[0]!.duel.opponent.hp).toBe(expectedHp);
    }
  }
  await core.prepareRound("lobby");
  expect(latest()[0]!.duel).toMatchObject({ phase: "completed", outcome: outcomes[4] });
  expect(outcomes[0]!.players[1]!.hp).toBe(78);
  expect(core.endRound({ ...command, cause: { type: "target-arrival" } }).ok).toBe(false);
  expect(core.canNavigate(command)).toBe(false);
  expect(core.readyForNextRound(command)).toBe(false);
});

it("cannot replace an active Round with preparation", async () => {
  const { core, latest, command, events } = await activeRound();
  const count = events.length;
  await core.prepareRound("lobby");
  expect(events).toHaveLength(count);
  expect(latest()[0]!.duel).toMatchObject({ phase: "active", round: { id: command.roundId } });
});

it("rejects outcomes before activation and accepts a due start even before its timer fires", async () => {
  const { core, activate, latest, command } = await activeRound();
  core.recordNavigation({ ...command, expectedClicks: 0, destination: latest()[0]!.duel.round.prompt.target });
  core.endRound({ ...command, cause: { type: "target-arrival" } });
  core.readyForNextRound(command);
  core.readyForNextRound({ ...command, playerId: "opponent" });
  await core.prepareRound("lobby");
  const duel = latest()[0]!.duel;
  const next = { ...command, roundId: duel.round.id };
  expect(core.endRound({ ...next, cause: { type: "target-arrival" } }).ok).toBe(false);
  expect(core.recordNavigation({ ...next, expectedClicks: 0, destination: duel.round.prompt.target })).toBe(false);
  for (const playerId of ["host", "opponent"]) {
    core.acknowledgeRound({ ...next, playerId, kind: "received" });
    core.acknowledgeRound({ ...next, playerId, kind: "rendered" });
  }
  expect(core.endRound({ ...next, cause: { type: "target-arrival" } }).ok).toBe(false);
  expect(core.recordNavigation({ ...next, expectedClicks: 0, destination: duel.round.prompt.target })).toBe(false);
  vi.setSystemTime(106_000);
  expect(core.recordNavigation({ ...next, expectedClicks: 0, destination: duel.round.prompt.target })).toBe(true);
  expect(core.endRound({ ...next, cause: { type: "target-arrival" } })).toMatchObject({ ok: true, outcome: {
    startsAt: 106_000, endedAt: 106_000,
  } });
  await activate();
  expect(latest()[0]!.duel.phase).toBe("active");
});

it("requires distinct current-Round readiness before preparing again", async () => {
  const { core, latest, command } = await activeRound();
  expect(core.readyForNextRound(command)).toBe(false);
  core.recordNavigation({ ...command, expectedClicks: 0, destination: latest()[0]!.duel.round.prompt.target });
  core.endRound({ ...command, cause: { type: "target-arrival" } });
  const ended = latest()[0]!.duel;
  await core.prepareRound("lobby");
  expect(latest()[0]!.duel).toEqual(ended);
  for (const invalid of [{ roundId: "stale" }, { duelId: "wrong" }, { playerId: "outsider" }]) {
    expect(core.readyForNextRound({ ...command, ...invalid })).toBe(false);
  }
  expect(core.readyForNextRound(command)).toBe(true);
  expect(core.readyForNextRound(command)).toBe(false);
  await core.prepareRound("lobby");
  expect(latest()[0]!.duel).toMatchObject({ phase: "post-round", readyPlayerIds: ["host"] });
  expect(core.readyForNextRound({ ...command, playerId: "opponent" })).toBe(true);
  await core.prepareRound("lobby");
  expect(latest()[0]!.duel).toMatchObject({ phase: "preparing", round: { number: 2 }, self: { hp: 100 }, opponent: { hp: 78 } });
  expect(latest()[0]!.duel.round.prompt.id).not.toBe(ended.round.prompt.id);
  expect(core.readyForNextRound(command)).toBe(false);
});
