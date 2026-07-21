import { describe, expect, test } from "vitest";

import { deterministicPromptCatalog } from "./fixtures.js";
import { createLobbyPromptSelector } from "./selector.js";

describe("LobbyPromptSelector", () => {
  test("exhausts enabled Prompts across Rounds and Rematches before reshuffling", () => {
    const randomValues = [0.999, 0.999, 0, 0];
    const selector = createLobbyPromptSelector(deterministicPromptCatalog, {
      random: () => randomValues.shift() ?? 0.999,
    });

    expect([
      selector.selectNext().id,
      selector.selectNext().id,
      selector.selectNext().id,
      selector.selectNext().id,
    ]).toEqual(["fixture-first", "fixture-second", "fixture-third", "fixture-second"]);
  });

  test("gives each new Lobby the full enabled catalog", () => {
    const firstLobby = createLobbyPromptSelector(deterministicPromptCatalog, {
      random: () => 0.999,
    });
    firstLobby.selectNext();
    firstLobby.selectNext();

    const newLobby = createLobbyPromptSelector(deterministicPromptCatalog, {
      random: () => 0.999,
    });

    expect(newLobby.selectNext().id).toBe("fixture-first");
  });
});
