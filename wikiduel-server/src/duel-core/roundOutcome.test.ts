import { expect, it } from "vitest";
import { createDuelCore, type DuelEvent } from "./duelCore.js";
import { preparedArticle } from "./fixtures.js";
import { deterministicPromptCatalog } from "../prompt-catalog/fixtures.js";

export async function roundFixture(timeLimitEnabled = false) {
  let time = 100_000;
  const timers: { callback: () => void; delay: number; cancelled: boolean }[] = [];
  const events: DuelEvent[] = [];
  const players = ["host", "opponent"].map((id, index) => ({ id, name: id,
    role: index === 0 ? "host" as const : "opponent" as const, connected: true, ready: true }));
  const core = createDuelCore({ promptCatalog: deterministicPromptCatalog, random: () => 0,
    now: () => time, schedule: (callback, delay) => {
      const timer = { callback, delay, cancelled: false }; timers.push(timer);
      return () => { timer.cancelled = true; };
    }, repository: { getByTitle: async (title) => ({ ok: true, article: { ...preparedArticle,
      identity: deterministicPromptCatalog.prompts.find((p) => p.start.title === title)!.start } }) },
    onEvent: (_, event) => events.push(event),
  });
  core.startDuel({ lobbyId: "lobby", actorId: "host", players, timeLimitEnabled });
  const latest = () => {
    const event = events.at(-1)!;
    if (event.type !== "projections") throw new Error("Expected projections");
    return event.projections;
  };
  const activate = async () => {
    await core.prepareRound("lobby");
    const duel = latest()[0]!.duel;
    const command = { lobbyId: "lobby", duelId: duel.id, roundId: duel.round.id, playerId: "host" };
    for (const playerId of ["host", "opponent"]) {
      core.acknowledgeRound({ ...command, playerId, kind: "received" });
      core.acknowledgeRound({ ...command, playerId, kind: "rendered" });
    }
    time += 3000;
    timers.at(-1)!.callback();
    return command;
  };
  const command = await activate();
  return { core, events, timers, latest, activate, command, players, setTime: (value: number) => { time = value; } };
}

it("freezes the first arrival and lets the later fewer-click route win", async () => {
  const { core, latest, command, setTime } = await roundFixture();
  const target = latest()[0]!.duel.round.prompt.target;
  core.recordNavigation({ ...command, expectedClicks: 0, destination: { pageId: 42, title: "Detour" } });
  setTime(104_000);
  core.recordNavigation({ ...command, expectedClicks: 1, destination: target });
  expect(latest()[0]!.duel).toMatchObject({ phase: "active", self: { arrived: true, arrivalElapsedMs: 1000, clicks: 2 } });
  expect(core.checkNavigationEligibility(command)).toBe(false);
  expect(core.recordNavigation({ ...command, expectedClicks: 2, destination: target })).toBe(false);
  expect(latest()[1]!.duel.opponent).toEqual({ id: "host", name: "host", role: "host", hp: 100, clicks: 2, connected: true, arrived: true });
  setTime(106_000);
  core.recordNavigation({ ...command, playerId: "opponent", expectedClicks: 0, destination: target });
  expect(latest()[0]!.duel).toMatchObject({ phase: "post-round", outcome: {
    winnerId: "opponent", winReason: "fewer-clicks", damage: { finalDamage: 28 },
    players: [{ arrived: true, activeElapsedMs: 1000, hp: 72, hpLoss: 28 }, { arrived: true, activeElapsedMs: 3000, hp: 100, hpLoss: 0 }],
  } });
});


it.each(["host", "opponent"])("uses acceptance order for equal clicks and identical timestamps, with %s first", async (first) => {
  const { core, latest, command } = await roundFixture();
  const target = latest()[0]!.duel.round.prompt.target;
  const second = first === "host" ? "opponent" : "host";
  core.recordNavigation({ ...command, playerId: first, expectedClicks: 0, destination: target });
  core.recordNavigation({ ...command, playerId: second, expectedClicks: 0, destination: target });
  expect(latest()[0]!.duel).toMatchObject({ outcome: { winnerId: first, winReason: "earlier-arrival", damage: { finalDamage: 25 } } });
});

it.each([false, true])("expires once at the deadline with one arrival = %s even when the callback is late", async (arrived) => {
  const { core, latest, command, setTime, timers, events } = await roundFixture(true);
  expect(latest()[0]!.duel).toMatchObject({ startsAt: 103_000, expiresAt: 403_000 });
  const target = latest()[0]!.duel.round.prompt.target;
  if (arrived) {
    setTime(105_000);
    core.recordNavigation({ ...command, expectedClicks: 0, destination: target });
  }
  setTime(410_000);
  const timer = timers.at(-1)!;
  timer.callback();
  const state = latest()[0]!.duel;
  expect(state).toMatchObject({ phase: "post-round", outcome: { endReason: "time-limit", endedAt: 403_000,
    winnerId: arrived ? "host" : null, winReason: arrived ? "sole-arrival" : "neither-arrived",
    damage: { finalDamage: arrived ? 60 : 0 }, players: [
      { arrived, activeElapsedMs: arrived ? 2000 : 300_000, hp: 100, hpLoss: 0 },
      { arrived: false, activeElapsedMs: 300_000, hp: arrived ? 40 : 100, hpLoss: arrived ? 60 : 0 },
    ] } });
  const count = events.length;
  timer.callback();
  expect(core.recordNavigation({ ...command, playerId: "opponent", expectedClicks: 0, destination: target })).toBe(false);
  expect(events).toHaveLength(count);
  expect(timer.cancelled).toBe(true);
  expect(latest()[0]!.duel).toEqual(state);
});

it.each([402_999, 403_000, 403_001])("checks acceptance at %i without relying on the scheduled callback", async (time) => {
  const { core, latest, command, setTime } = await roundFixture(true);
  const target = latest()[0]!.duel.round.prompt.target;
  core.recordNavigation({ ...command, expectedClicks: 0, destination: target });
  setTime(time);
  expect(core.recordNavigation({ ...command, playerId: "opponent", expectedClicks: 0, destination: target })).toBe(time < 403_000);
  expect(latest()[0]!.duel).toMatchObject({ outcome: {
    winReason: time < 403_000 ? "earlier-arrival" : "sole-arrival",
    players: [{ clicks: 1 }, { clicks: time < 403_000 ? 1 : 0 }],
  } });
});

it("has no deadline when disabled and still needs both arrivals after five minutes", async () => {
  const { core, latest, command, setTime, timers } = await roundFixture();
  expect(latest()[0]!.duel).toMatchObject({ expiresAt: null });
  core.recordNavigation({ ...command, expectedClicks: 0, destination: latest()[0]!.duel.round.prompt.target });
  setTime(900_000);
  expect(core.checkNavigationEligibility({ ...command, playerId: "opponent" })).toBe(true);
  expect(latest()[0]!.duel.phase).toBe("active");
  expect(timers.filter((timer) => timer.delay === 300_000)).toHaveLength(0);
});

it.each([false, true])("plays to zero HP, retains final review and resets a Rematch with timer enabled = %s", async (timed) => {
  const { core, latest, command: first, activate, timers, setTime, events } = await roundFixture(timed);
  let command = first;
  let time = 103_000;
  const outcomes = [];
  const hps = timed ? [100, 40, 0] : [75, 50, 25, 0];
  for (const [index, hp] of hps.entries()) {
    const target = latest()[0]!.duel.round.prompt.target;
    if (!timed || index > 0) core.recordNavigation({ ...command, expectedClicks: 0, destination: target });
    if (timed) { time += 300_000; setTime(time); timers.at(-1)!.callback(); }
    else core.recordNavigation({ ...command, playerId: "opponent", expectedClicks: 0, destination: target });
    const state = latest()[0]!.duel;
    if (state.phase !== "post-round" && state.phase !== "completed") throw new Error("Expected outcome");
    outcomes.push(state.outcome);
    expect(state.outcome.players[1]!.hp).toBe(hp);
    expect(state.outcome.final).toBe(hp === 0);
    if (hp !== 0) {
      expect(core.continueToPostDuel(command)).toBe(false);
      expect(core.readyForNextRound({ ...command, roundId: "stale" })).toBe(false);
      expect(core.readyForNextRound(command)).toBe(true);
      expect(core.readyForNextRound(command)).toBe(false);
      await core.prepareRound("lobby");
      expect(latest()[0]!.duel.phase).toBe("post-round");
      core.readyForNextRound({ ...command, playerId: "opponent" });
      const old = command;
      const oldTimers = [...timers];
      command = await activate(); time += 3000;
      const count = events.length;
      oldTimers.forEach((timer) => timer.callback());
      expect(events).toHaveLength(count);
      expect(core.recordNavigation({ ...old, expectedClicks: 0, destination: target })).toBe(false);
      expect(latest()[0]!.duel).toMatchObject({ self: { clicks: 0, arrived: false, arrivalElapsedMs: null } });
    }
  }
  if (timed) expect(outcomes.at(-1)!).toMatchObject({ damage: { finalDamage: 60 }, players: [{ hpLoss: 0 }, { hpLoss: 40 }] });
  const finalReview = latest()[1]!.duel;
  expect(core.readyForNextRound(command)).toBe(false);
  expect(core.requestRematch(command)).toBe(false);
  core.continueToPostDuel(command);
  expect(core.continueToPostDuel(command)).toBe(false);
  expect(latest()[1]!.duel).toEqual(finalReview);
  const summary = latest()[0]!.duel;
  expect(summary).toMatchObject({ phase: "post-duel", summary: { winnerId: "host", players: [{ hp: 100 }, { hp: 0 }] } });
  if (timed) expect(summary).toMatchObject({ summary: { rounds: [{ winnerId: null, damage: 0, winReason: "neither-arrived" },
    { winnerId: "host", damage: 60, winReason: "sole-arrival" }, { winnerId: "host", damage: 60, winReason: "sole-arrival" }] } });
  const history = core.getLobbyPromptHistory("lobby");
  core.requestRematch(command);
  expect(core.requestRematch({ ...command, playerId: "opponent" })).toBe(false);
  core.continueToPostDuel({ ...command, playerId: "opponent" });
  const oldTimers = [...timers];
  core.requestRematch({ ...command, playerId: "opponent" });
  const rematch = latest()[0]!.duel;
  expect(rematch.id).not.toBe(command.duelId);
  expect(rematch).toMatchObject({ phase: "preparing", round: { number: 1 }, self: { hp: 100, clicks: 0, arrived: false }, opponent: { hp: 100 } });
  expect(core.getLobbyPromptHistory("lobby").usedPromptIds).toEqual(timed ? ["fixture-first"] : [...history.usedPromptIds, rematch.round.prompt.id]);
  await activate();
  const count = events.length;
  oldTimers.forEach((timer) => timer.callback());
  expect(events).toHaveLength(count);
  expect(latest()[0]!.duel).toMatchObject({ expiresAt: timed ? time + 303_000 : null });
});

it.each(["leave", "disconnect", "disband", "dispose"])("invalidates timers and waiting routes on %s", async (action) => {
  const { core, latest, command, timers, events, setTime } = await roundFixture(true);
  core.recordNavigation({ ...command, expectedClicks: 0, destination: latest()[0]!.duel.round.prompt.target });
  if (action === "leave") expect(core.leaveDuel(command)).toMatchObject({ type: "duel-forfeited", winnerId: "opponent" });
  else if (action === "disconnect") expect(core.disconnectPlayer(command)).toMatchObject({ winnerId: "opponent" });
  else if (action === "disband") core.disbandLobby("lobby");
  else core.dispose();
  const count = events.length;
  setTime(500_000); timers.forEach((timer) => timer.callback());
  expect(events).toHaveLength(count);
  expect(core.checkNavigationEligibility(command)).toBe(false);
  expect(core.hasActiveDuel("lobby")).toBe(false);
  expect(core.continueToPostDuel(command)).toBe(false);
});

it("publishes an immutable outcome and rejects duplicate or stale Navigation", async () => {
  const { core, latest, command, events } = await roundFixture();
  const target = latest()[0]!.duel.round.prompt.target;
  for (const invalid of [{ playerId: "outsider" }, { roundId: "stale" }, { duelId: "stale" }]) {
    expect(core.recordNavigation({ ...command, ...invalid, expectedClicks: 0, destination: target })).toBe(false);
  }
  core.recordNavigation({ ...command, expectedClicks: 0, destination: target });
  core.recordNavigation({ ...command, playerId: "opponent", expectedClicks: 0, destination: target });
  const duel = latest()[0]!.duel;
  if (duel.phase !== "post-round") throw new Error("Expected outcome");
  const saved = structuredClone(duel.outcome);
  const count = events.length;
  expect(core.recordNavigation({ ...command, expectedClicks: 1, destination: target })).toBe(false);
  expect(core.checkNavigationEligibility(command)).toBe(false);
  expect(events).toHaveLength(count);
  expect(() => Object.assign(duel.outcome.players[0]!.path[0]!, { title: "Changed" })).toThrow();
  expect(() => Object.assign(duel.outcome.damage, { finalDamage: 999 })).toThrow();
  expect(() => Object.assign(duel.outcome.players[1]!, { hp: 999 })).toThrow();
  expect(duel.outcome).toEqual(saved);
});
