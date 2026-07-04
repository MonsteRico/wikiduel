# Add a Deterministic Article Fixture Graph

Status: needs-triage
Scope: MVP optional
Category: enhancement

## What to build

Provide a small reusable article graph that behaves like the live Wikipedia boundary, allowing complete Duels and browser tests to run without network access or mutable external content.

## Acceptance criteria

- [ ] The graph contains at least one complete prompt with multiple valid routes.
- [ ] Redirects, invalid links, and Target Arrival can be exercised deterministically.
- [ ] The same article interface serves fixture and live content.

## Blocked by

- The required Playable Article and Navigation contracts.

## Out of scope

- Mirroring a large Wikipedia subset
- Generating fixtures automatically from live revisions

## Comments

- 2026-07-03: Classified as MVP optional; useful for deterministic testing but not part of the product hypothesis.
