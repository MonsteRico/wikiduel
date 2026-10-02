import type { DamageBreakdown } from "@wikiduel/contracts";
export type { DamageBreakdown } from "@wikiduel/contracts";

export type FrozenRoundClicks = Readonly<{
  kind: "completed-routes";
  winnerClicks: number;
  loserClicks: number;
}>;

/** Apply the deployed rule to completed routes or the expiry outcome. */
export function calculateDamage(input: FrozenRoundClicks | Readonly<{ kind: "sole-arrival" }> | Readonly<{ kind: "draw" }>): DamageBreakdown {
  const ruleId = "click-scored-v2";
  if (input.kind === "sole-arrival") return Object.freeze({ kind: input.kind, ruleId, finalDamage: 60 });
  if (input.kind === "draw") return Object.freeze({ kind: input.kind, ruleId, finalDamage: 0 });
  const { winnerClicks, loserClicks } = input;
  if (
    !Number.isSafeInteger(winnerClicks) || winnerClicks < 0 ||
    !Number.isSafeInteger(loserClicks) || loserClicks < winnerClicks
  ) {
    throw new RangeError("Frozen Round click counts must be non-negative safe integers.");
  }

  const baseDamage = 25;
  const clickMultiplier = 3;
  const minimumDamage = 25;
  const maximumDamage = 60;
  const clickDifferential = loserClicks - winnerClicks;
  const multiplierContribution = clickMultiplier * clickDifferential;
  const unclampedDamage = baseDamage + multiplierContribution;

  return Object.freeze({
    kind: "completed-routes", ruleId,
    winnerClicks,
    loserClicks,
    baseDamage,
    clickDifferential,
    clickMultiplier,
    multiplierContribution,
    unclampedDamage,
    minimumDamage,
    maximumDamage,
    finalDamage: Math.min(maximumDamage, Math.max(minimumDamage, unclampedDamage)),
  });
}
