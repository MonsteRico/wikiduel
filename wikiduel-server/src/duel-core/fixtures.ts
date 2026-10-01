import type { PlayableArticle } from "@wikiduel/contracts";

export const preparedArticle: PlayableArticle = {
  identity: { pageId: 1001, title: "Fixture Start One" },
  revision: { id: 1, timestamp: "2026-10-01T00:00:00Z" },
  attribution: {
    sourceUrl: "https://en.wikipedia.org/wiki/Fixture_Start_One",
    historyUrl: "https://en.wikipedia.org/w/index.php?title=Fixture_Start_One&action=history",
    licenseName: "Creative Commons Attribution-ShareAlike 4.0 International",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    modificationNotice: "Adapted for Wiki Duel",
  },
  document: { title: "Fixture Start One", tableOfContents: [], blocks: [] },
};
