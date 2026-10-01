import { describe, expect, test } from "vitest";

import { calculateDamage } from "./damageRule.js";

describe("Damage Rule", () => {
  test("returns the labeled base breakdown for equal frozen click counts", () => {
    const clicks = Object.freeze({ winnerClicks: 5, loserClicks: 5 });

    expect(calculateDamage(clicks)).toEqual({
      winnerClicks: 5,
      loserClicks: 5,
      baseDamage: 25,
      clickDifferential: 0,
      clickMultiplier: 3,
      multiplierContribution: 0,
      unclampedDamage: 25,
      minimumDamage: 15,
      maximumDamage: 60,
      finalDamage: 25,
    });
  });
});

test.each([
  { winnerClicks: 4, loserClicks: 0, clickDifferential: -4, multiplierContribution: -12, unclampedDamage: 13, finalDamage: 15 },
  { winnerClicks: 3, loserClicks: 0, clickDifferential: -3, multiplierContribution: -9, unclampedDamage: 16, finalDamage: 16 },
  { winnerClicks: 1, loserClicks: 12, clickDifferential: 11, multiplierContribution: 33, unclampedDamage: 58, finalDamage: 58 },
  { winnerClicks: 1, loserClicks: 13, clickDifferential: 12, multiplierContribution: 36, unclampedDamage: 61, finalDamage: 60 },
  { winnerClicks: 1000000, loserClicks: 0, clickDifferential: -1000000, multiplierContribution: -3000000, unclampedDamage: -2999975, finalDamage: 15 },
  { winnerClicks: 1, loserClicks: 1000001, clickDifferential: 1000000, multiplierContribution: 3000000, unclampedDamage: 3000025, finalDamage: 60 },
])("applies the locked bounds for $winnerClicks winner clicks and $loserClicks loser clicks", (expected) => {
  const clicks = Object.freeze({ winnerClicks: expected.winnerClicks, loserClicks: expected.loserClicks });

  expect(calculateDamage(clicks)).toEqual({
    ...expected,
    baseDamage: 25,
    clickMultiplier: 3,
    minimumDamage: 15,
    maximumDamage: 60,
  });
});

test.each([NaN, Infinity, -Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
  "rejects invalid click count %s instead of returning a misleading breakdown",
  (invalidClicks) => {
    expect(() => calculateDamage({ winnerClicks: invalidClicks, loserClicks: 0 })).toThrow(RangeError);
    expect(() => calculateDamage({ winnerClicks: 1, loserClicks: invalidClicks })).toThrow(RangeError);
  },
);

test("derives damage only from click counts and returns a stable snapshot", () => {
  const clicks = { winnerClicks: 4, loserClicks: 7, finalDamage: 60 };
  const result = calculateDamage(clicks);

  expect(result.finalDamage).toBe(34);
  expect(calculateDamage(clicks)).toEqual(result);
  clicks.loserClicks = 100;
  expect(result.loserClicks).toBe(7);
  expect(result.finalDamage).toBe(34);
});
