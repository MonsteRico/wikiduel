# Explore an animated graph for Post-Round paths

Status: needs-triage
Scope: MVP optional
Category: planning

## Direction

Explore a shared Post-Round visualization showing the paths both players took. Animate with a slow start, a faster middle, and a slow finish so players can follow and compare their journeys.

The graph is a stylized representation of Wikipedia connections, not a complete Wikipedia link graph. Actual player paths must remain faithful to recorded Navigation. Any decorative surrounding connections are a design question, not a requirement to crawl Wikipedia.

This starts the Wayfinder initiative. It is separate from the required [click-scored round change](../../duel-lifecycle/tickets/17-refine-click-scored-rounds.md). Provisionally classify it as MVP optional; confirm its milestone during refinement.

## Exploration questions

- What should players notice: shared articles, divergent routes, wasted clicks, completion order, or something else?
- Use one shared graph, two aligned paths, or another layout? How should cycles, repeated visits, shared nodes, and shared edges appear?
- Would surrounding graph decoration help? How can it avoid implying nonexistent navigable links?
- Does animation follow actual navigation timing or a compressed sequence? Define slow-fast-slow pacing, synchronization, and total duration.
- How should partial routes and timeout draws appear under the new Round rules?
- Define automatic playback, replay, skip, reduced-motion behavior, and a readable static alternative.
- How does the graph fit path comparison and Ready/Continue controls without delaying the next Round?
- Can existing Round Outcomes supply the data, or are additional timestamps needed?

## Planning acceptance criteria

- [ ] Agree on the first version's purpose and scope.
- [ ] Compare layout approaches and prototype the chosen direction with overlap, cycles, long routes, and unfinished routes.
- [ ] Set animation, accessibility, and readability requirements.
- [ ] Define required data and distinguish actual paths from decorative graph content.
- [ ] Reconcile with [route-replay/01](../../route-replay/tickets/01-route-replay.md) to avoid duplicate work.
- [ ] Create implementation tickets after the visual and interaction approach is accepted.

## Out of scope

- Crawling or rendering the complete Wikipedia graph
- Shortest-path computation or claims about optimal routes
- Persistent match history, public sharing, or spectators

## Comments

- 2026-10-02: Maintainer proposed animated Post-Round route comparison with slow-fast-slow pacing and a stylized Wikipedia connection graph. The rendering approach remains open.
