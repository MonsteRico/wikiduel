import type { Prompt, PromptCatalog } from "./catalog.js";

export type LobbyPromptSelector = Readonly<{
  selectNext(): Prompt;
}>;

export type LobbyPromptSelectorOptions = Readonly<{
  random?: () => number;
}>;

function shuffled(
  prompts: readonly Prompt[],
  random: () => number,
): Prompt[] {
  const result = [...prompts];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index];
    const swap = result[swapIndex];
    if (current === undefined || swap === undefined) continue;
    result[index] = swap;
    result[swapIndex] = current;
  }
  return result;
}

export function createLobbyPromptSelector(
  catalog: PromptCatalog,
  options: LobbyPromptSelectorOptions = {},
): LobbyPromptSelector {
  const enabledPrompts = catalog.prompts.filter((prompt) => prompt.enabled);
  if (enabledPrompts.length === 0) {
    throw new Error("Cannot create a Lobby Prompt selector without an enabled Prompt.");
  }

  const random = options.random ?? Math.random;
  let available: Prompt[] = [];

  return Object.freeze({
    selectNext(): Prompt {
      if (available.length === 0) available = shuffled(enabledPrompts, random);
      const prompt = available.shift();
      if (prompt === undefined) {
        throw new Error("Enabled Prompt shuffle unexpectedly produced no Prompt.");
      }
      return prompt;
    },
  });
}
