import { describe, expect, test } from "vitest";

import { deterministicPromptCatalog } from "./fixtures.js";
import {
  EMPTY_LOBBY_PROMPT_HISTORY,
  selectLobbyPrompt,
  type LobbyPromptHistory,
} from "./selector.js";

describe("selectLobbyPrompt", () => {
  test("advances explicit Lobby history and excludes disabled Prompts", () => {
    expect(EMPTY_LOBBY_PROMPT_HISTORY).toEqual({ usedPromptIds: [] });

    const selection = selectLobbyPrompt(
      deterministicPromptCatalog,
      EMPTY_LOBBY_PROMPT_HISTORY,
      { random: () => 0.999 },
    );

    expect(selection).toMatchObject({
      prompt: { id: "fixture-third", enabled: true },
      history: { usedPromptIds: ["fixture-third"] },
      reshuffled: false,
    });
  });

  test("exhausts enabled Prompts before a new cycle resets history", () => {
    let history: LobbyPromptHistory = EMPTY_LOBBY_PROMPT_HISTORY;

    const first = selectLobbyPrompt(deterministicPromptCatalog, history, { random: () => 0 });
    history = first.history;
    const second = selectLobbyPrompt(deterministicPromptCatalog, history, { random: () => 0 });
    history = second.history;
    const third = selectLobbyPrompt(deterministicPromptCatalog, history, { random: () => 0 });
    history = third.history;
    const nextCycle = selectLobbyPrompt(deterministicPromptCatalog, history, { random: () => 0 });

    expect([first.prompt.id, second.prompt.id, third.prompt.id]).toEqual([
      "fixture-first",
      "fixture-second",
      "fixture-third",
    ]);
    expect(third.history.usedPromptIds).toEqual([
      "fixture-first",
      "fixture-second",
      "fixture-third",
    ]);
    expect(nextCycle).toMatchObject({
      prompt: { id: "fixture-first" },
      history: { usedPromptIds: ["fixture-first"] },
      reshuffled: true,
    });
  });

  test("normalizes unknown, duplicated, and no-longer-enabled history IDs", () => {
    const selection = selectLobbyPrompt(
      deterministicPromptCatalog,
      {
        usedPromptIds: [
          "unknown",
          "fixture-first",
          "fixture-first",
          "fixture-disabled",
          "fixture-second",
        ],
      },
      { random: () => 0 },
    );

    expect(selection).toMatchObject({
      prompt: { id: "fixture-third" },
      history: {
        usedPromptIds: ["fixture-first", "fixture-second", "fixture-third"],
      },
      reshuffled: false,
    });
  });
});
