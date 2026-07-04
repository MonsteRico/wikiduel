# Scale and Evolve the Architecture

Status: needs-triage
Scope: Future
Category: enhancement
Type: Epic

## Direction

Use evidence from completed MVP testing to identify where the current single-process, in-memory, raw-WebSocket architecture limits reliability, development speed, or scale. This Epic is a parent for later concrete issues; it does not prescribe a replacement stack before those constraints are observed.

Potential child areas include horizontal realtime scaling, durable state, shared transport contracts, client-state organization, deployment topology, observability, and selective framework or library changes.

## Success condition

The Epic is ready to split when measured constraints and desired operating scale are known. Each child issue must be an independently verifiable migration or capability, with compatibility and rollback boundaries appropriate to its risk.

## Out of scope

- Replacing working technology solely to match the original PRD proposal
- A single all-at-once rewrite
- Choosing infrastructure before testing establishes a need

## Comments

- 2026-07-03: Intentionally retained as a vague Future Epic. It expresses direction rather than agent-ready implementation work.
