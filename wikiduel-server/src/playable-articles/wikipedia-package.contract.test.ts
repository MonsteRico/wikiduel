import wikipedia from "wikipedia";
import { expect, test } from "vitest";

test("the installed wikipedia package exposes the capabilities used by the gateway", () => {
  type RuntimeClient = {
    page?: unknown;
    setUserAgent?: unknown;
    default?: RuntimeClient;
  };
  const moduleValue = wikipedia as unknown as RuntimeClient;
  const client = typeof moduleValue.page === "function" ? moduleValue : moduleValue.default;

  expect(typeof client?.page).toBe("function");
  expect(typeof client?.setUserAgent).toBe("function");
});
