import type { PromptCatalog } from "./catalog.js";

export const deterministicPromptCatalog: PromptCatalog = Object.freeze({
  prompts: Object.freeze([
    Object.freeze({
      id: "fixture-first",
      start: Object.freeze({ pageId: 1001, title: "Fixture Start One" }),
      target: Object.freeze({ pageId: 1002, title: "Fixture Target One" }),
      enabled: true,
      metadata: Object.freeze({ purpose: "deterministic-test-fixture" }),
    }),
    Object.freeze({
      id: "fixture-disabled",
      start: Object.freeze({ pageId: 1003, title: "Fixture Start Disabled" }),
      target: Object.freeze({ pageId: 1004, title: "Fixture Target Disabled" }),
      enabled: false,
      metadata: Object.freeze({ purpose: "deterministic-test-fixture" }),
    }),
    Object.freeze({
      id: "fixture-second",
      start: Object.freeze({ pageId: 1005, title: "Fixture Start Two" }),
      target: Object.freeze({ pageId: 1006, title: "Fixture Target Two" }),
      enabled: true,
      metadata: Object.freeze({ purpose: "deterministic-test-fixture" }),
    }),
    Object.freeze({
      id: "fixture-third",
      start: Object.freeze({ pageId: 1007, title: "Fixture Start Three" }),
      target: Object.freeze({ pageId: 1008, title: "Fixture Target Three" }),
      enabled: true,
      metadata: Object.freeze({ purpose: "deterministic-test-fixture" }),
    }),
  ]),
});
