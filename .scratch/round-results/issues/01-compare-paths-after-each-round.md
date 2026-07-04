# Compare Paths After Each Round

Status: needs-triage
Scope: MVP required
Category: enhancement

## What to build

After every Target Arrival or timeout draw, freeze both routes and show the Round outcome, start and target, both paths, click counts, active elapsed times, damage breakdown, and resulting HP before either player continues.

## Acceptance criteria

- [ ] Both players see the same authoritative Round outcome and damage.
- [ ] Both frozen paths are readable side by side, including the non-finishing player's partial route.
- [ ] A no-damage timeout draw is clearly distinct from a win.
- [ ] A non-final Round continues only after both players select `Ready for Next Round`.
- [ ] The final Round still shows this comparison before the post-Duel summary.

## Blocked by

- The required authoritative Navigation, Round, path tracking, and Damage Rule slices.

## Out of scope

- Animated route replay
- Sharing the comparison outside the Lobby
- Automated route-quality judgments

## Comments

- 2026-07-03: This reveal and discussion moment is part of the core product hypothesis, not summary polish.
