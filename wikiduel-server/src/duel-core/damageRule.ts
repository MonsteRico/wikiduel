import type { DamageBreakdown } from "@wikiduel/contracts";
export type { DamageBreakdown } from "@wikiduel/contracts";

export type FrozenRoundClicks = Readonly<{
  winnerClicks: number;
  loserClicks: number;
}>;

/** Apply the locked MVP rule to click counts frozen by the authoritative Round. */
export function calculateDamage({
  winnerClicks,
  loserClicks,
}: FrozenRoundClicks): DamageBreakdown {
  if (
    !Number.isSafeInteger(winnerClicks) || winnerClicks < 0 ||
    !Number.isSafeInteger(loserClicks) || loserClicks < 0
  ) {
    throw new RangeError("Frozen Round click counts must be non-negative safe integers.");
  }

  const baseDamage = 25;
  const clickMultiplier = 3;
  const minimumDamage = 15;
  const maximumDamage = 60;
  const clickDifferential = loserClicks - winnerClicks;
  const multiplierContribution = clickMultiplier * clickDifferential;
  const unclampedDamage = baseDamage + multiplierContribution;

  return Object.freeze({
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
