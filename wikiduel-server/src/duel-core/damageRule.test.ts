import { expect, test } from "vitest";
import { calculateDamage } from "./damageRule.js";

test.each([[0, 25], [1, 28], [11, 58], [12, 60], [100, 60]])(
  "completed routes with a %i click difference deal %i damage", (difference, damage) => {
    expect(calculateDamage({ kind: "completed-routes", winnerClicks: 2, loserClicks: 2 + difference })).toMatchObject({
      kind: "completed-routes", ruleId: "click-scored-v2", minimumDamage: 25, maximumDamage: 60, finalDamage: damage,
    });
  },
);
test("expiry damage does not depend on unfinished clicks", () => {
  expect(calculateDamage({ kind: "sole-arrival" })).toEqual({ kind: "sole-arrival", ruleId: "click-scored-v2", finalDamage: 60 });
  expect(calculateDamage({ kind: "draw" })).toEqual({ kind: "draw", ruleId: "click-scored-v2", finalDamage: 0 });
});
test.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid clicks %s", (value) => {
  expect(() => calculateDamage({ kind: "completed-routes", winnerClicks: value, loserClicks: 5 })).toThrow(RangeError);
  expect(() => calculateDamage({ kind: "completed-routes", winnerClicks: 0, loserClicks: value })).toThrow(RangeError);
});
test("rejects a completed-route winner with more clicks", () => {
  expect(() => calculateDamage({ kind: "completed-routes", winnerClicks: 5, loserClicks: 4 })).toThrow(RangeError);
});
