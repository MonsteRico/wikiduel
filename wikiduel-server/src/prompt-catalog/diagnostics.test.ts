import { expect, test } from "vitest";

import type { PromptCatalogDiagnosticCode } from "./catalog.js";

test("Prompt Catalog diagnostics use the closed set of emitted codes", () => {
  const diagnosticCodes: Record<PromptCatalogDiagnosticCode, true> = {
    "invalid-document": true,
    "unsupported-version": true,
    "unknown-field": true,
    "invalid-field": true,
    "invalid-record": true,
    "duplicate-id": true,
    "endpoint-not-playable": true,
    "identical-endpoints": true,
    "duplicate-ordered-pair": true,
    "no-enabled-prompts": true,
    "seed-file-unreadable": true,
    "invalid-json": true,
  };

  expect(Object.keys(diagnosticCodes)).toEqual([
    "invalid-document",
    "unsupported-version",
    "unknown-field",
    "invalid-field",
    "invalid-record",
    "duplicate-id",
    "endpoint-not-playable",
    "identical-endpoints",
    "duplicate-ordered-pair",
    "no-enabled-prompts",
    "seed-file-unreadable",
    "invalid-json",
  ]);
});
