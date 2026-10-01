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
