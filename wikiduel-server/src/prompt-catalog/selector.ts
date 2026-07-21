import type { Prompt, PromptCatalog } from "./catalog.js";

export type LobbyPromptHistory = Readonly<{
  usedPromptIds: readonly string[];
}>;

export type PromptSelection = Readonly<{
  prompt: Prompt;
  history: LobbyPromptHistory;
  reshuffled: boolean;
}>;

export type PromptSelectionOptions = Readonly<{
  random?: () => number;
}>;

export const EMPTY_LOBBY_PROMPT_HISTORY: LobbyPromptHistory = Object.freeze({
  usedPromptIds: Object.freeze([]),
});

export function selectLobbyPrompt(
  catalog: PromptCatalog,
  history: LobbyPromptHistory,
  options: PromptSelectionOptions = {},
): PromptSelection {
  const enabledPrompts = catalog.prompts.filter((prompt) => prompt.enabled);
  if (enabledPrompts.length === 0) {
    throw new Error("Cannot select a Lobby Prompt without an enabled Prompt.");
  }

  const enabledIds = new Set(enabledPrompts.map((prompt) => prompt.id));
  const seenIds = new Set<string>();
  const normalizedUsedPromptIds = history.usedPromptIds.filter((id) => {
    if (!enabledIds.has(id) || seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
  const unusedPrompts = enabledPrompts.filter((prompt) => !seenIds.has(prompt.id));
  const reshuffled = unusedPrompts.length === 0 && normalizedUsedPromptIds.length > 0;
  const availablePrompts = reshuffled ? enabledPrompts : unusedPrompts;
  const random = options.random ?? Math.random;
  const selectedIndex = Math.floor(random() * availablePrompts.length);
  const prompt = availablePrompts[selectedIndex];
  if (prompt === undefined) {
    throw new Error("Prompt randomness must return a value from 0 (inclusive) to 1 (exclusive).");
  }

  const usedPromptIds = Object.freeze(
    reshuffled
      ? [prompt.id]
      : [...normalizedUsedPromptIds, prompt.id],
  );
  const updatedHistory = Object.freeze({ usedPromptIds });
  return Object.freeze({ prompt, history: updatedHistory, reshuffled });
}
