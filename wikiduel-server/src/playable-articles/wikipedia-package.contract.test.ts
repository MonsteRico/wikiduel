import wikipedia from "wikipedia";
import { expect, test } from "vitest";

import { resolveWikipediaPackageClient } from "./gateway.js";

test("the installed wikipedia package exposes the capabilities used by the gateway", () => {
  const client = resolveWikipediaPackageClient(wikipedia);

  expect(typeof client.page).toBe("function");
  expect(typeof client.setUserAgent).toBe("function");
});
