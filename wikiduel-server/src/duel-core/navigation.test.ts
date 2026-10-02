import { expect, it } from "vitest";
import { createDuelCore, type DuelEvent } from "./duelCore.js";
import { preparedArticle } from "./fixtures.js";
import { deterministicPromptCatalog } from "../prompt-catalog/fixtures.js";

it("retrieves a linked destination before committing one canonical Navigation", async () => {
  const destination = { pageId: 42, title: "Linked article" };
  const article = { ...preparedArticle, document: { ...preparedArticle.document,
    blocks: [{ type: "paragraph" as const, children: [{ type: "navigation" as const,
      destination, children: [{ type: "text" as const, value: "Go" }] }] }] } };
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const events: DuelEvent[] = [];
  let now = 1000;
  const core = createDuelCore({ promptCatalog: deterministicPromptCatalog, random: () => 0,
    now: () => now, schedule: () => () => {},
    repository: { getByTitle: async (title) => {
      if (title === preparedArticle.identity.title) return { ok: true, article };
      await pending;
      return { ok: true, article: { ...preparedArticle, identity: destination } };
    } }, onEvent: (_, event) => events.push(event) });
  const players = ["host", "opponent"].map((id, index) => ({ id, name: id,
    role: index === 0 ? "host" as const : "opponent" as const, connected: true, ready: true }));
  core.startDuel({ lobbyId: "lobby", actorId: "host", players });
  await core.prepareRound("lobby");
  const latest = () => {
    const event = events.at(-1)!;
    if (event.type !== "projections") throw new Error("Expected projections");
    return event.projections;
  };
  const duel = latest()[0]!.duel;
  const command = { lobbyId: "lobby", playerId: "host", duelId: duel.id, roundId: duel.round.id,
    requestId: "one", source: preparedArticle.identity, expectedClicks: 0, destination };
  for (const playerId of ["host", "opponent"]) {
    core.acknowledgeRound({ ...command, playerId, kind: "received" });
    core.acknowledgeRound({ ...command, playerId, kind: "rendered" });
  }
  now += 3000;
  const navigation = core.navigate(command);
  expect(latest()[0]!.duel.self.clicks).toBe(0);
  await expect(core.navigate({ ...command, requestId: "conflict" })).resolves.toBe(false);
  release();
  await expect(navigation).resolves.toBe(true);
  expect(latest()[0]!.duel).toMatchObject({ self: { clicks: 1, path: [preparedArticle.identity, destination] }, round: { article: { identity: destination } } });
  expect(latest()[1]!.duel.round.article?.identity).toEqual(preparedArticle.identity);
  expect(latest()[1]!.duel.opponent).toMatchObject({ clicks: 1, connected: true });
  await expect(core.navigate(command)).resolves.toBe(false);
  core.dispose();
});

it.each(["before", "exact", "late", "forfeit", "next-round"])("checks a pending article lookup at acceptance: %s", async (ending) => {
  let time = 100_000;
  const target = deterministicPromptCatalog.prompts[0]!.target;
  const source = { ...preparedArticle, document: { ...preparedArticle.document, blocks: [
    { type: "paragraph" as const, children: [{ type: "navigation" as const, destination: target,
      children: [{ type: "text" as const, value: "Target" }] }] },
  ] } };
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const events: DuelEvent[] = [];
  const core = createDuelCore({ promptCatalog: deterministicPromptCatalog, random: () => 0,
    now: () => time, schedule: () => () => {},
    repository: { getByTitle: async (title) => {
      const prompt = deterministicPromptCatalog.prompts.find((entry) => entry.start.title === title);
      if (prompt) return { ok: true, article: { ...source, identity: prompt.start } };
      await pending; return { ok: true, article: { ...preparedArticle, identity: target } };
    } }, onEvent: (_, event) => events.push(event) });
  const players = ["host", "opponent"].map((id, index) => ({ id, name: id,
    role: index === 0 ? "host" as const : "opponent" as const, connected: true, ready: true }));
  core.startDuel({ lobbyId: "lobby", actorId: "host", players, timeLimitEnabled: true });
  await core.prepareRound("lobby");
  const latest = () => {
    const event = events.at(-1)!;
    if (event.type !== "projections") throw new Error("Expected projections");
    return event.projections[0]!.duel;
  };
  const duel = latest();
  const ids = { lobbyId: "lobby", duelId: duel.id, roundId: duel.round.id, playerId: "host" };
  for (const playerId of ["host", "opponent"]) {
    core.acknowledgeRound({ ...ids, playerId, kind: "received" });
    core.acknowledgeRound({ ...ids, playerId, kind: "rendered" });
  }
  time = 103_000;
  core.recordNavigation({ ...ids, playerId: "opponent", expectedClicks: 0, destination: target });
  time = 402_998;
  const command = { ...ids, requestId: "pending", expectedClicks: 0, source: source.identity, destination: target };
  const result = core.navigate(command);
  expect(await core.navigate(command)).toBe(false);
  time = ending === "before" ? 402_999 : ending === "exact" ? 403_000 : 410_000;
  if (ending === "forfeit") core.disconnectPlayer(ids);
  if (ending === "next-round") {
    core.canNavigate(ids);
    core.readyForNextRound(ids); core.readyForNextRound({ ...ids, playerId: "opponent" });
    await core.prepareRound("lobby");
    expect(latest().round.id).not.toBe(ids.roundId);
  }
  const count = events.length;
  release();
  expect(await result).toBe(ending === "before");
  if (ending === "forfeit" || ending === "next-round") expect(events).toHaveLength(count);
  else {
    expect(latest()).toMatchObject({ phase: "post-round", outcome: {
      winReason: ending === "before" ? "earlier-arrival" : "sole-arrival",
      endedAt: ending === "before" ? 402_999 : 403_000,
      players: [{ arrived: ending === "before", clicks: ending === "before" ? 1 : 0,
        activeElapsedMs: ending === "before" ? 299_999 : 300_000 }, { arrived: true, activeElapsedMs: 0 }],
    } });
    const saved = latest();
    expect(await core.navigate(command)).toBe(false);
    expect(latest()).toEqual(saved);
  }
  core.dispose();
});
