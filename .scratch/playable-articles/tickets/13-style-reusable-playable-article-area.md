> *This was generated from the Playable Article Lab follow-up request.*

# Style the Reusable Playable Article Area

Status: needs-triage
Scope: MVP required
Category: enhancement

## Parent

- [`playable-articles/10`](./10-render-typed-article-documents.md)
- [Playable Articles spec](../spec.md)

## What to build

Create the reusable visual treatment for the Playable Article area that appears
in the production Duel screen and the development-only Playable Article Lab.
The surface should make the Lab representative of gameplay while keeping the
typed Article Document renderer independent of Duel state, Lab diagnostics, and
WebSocket transport.

## Acceptance criteria

- [ ] The Lab and Duel article areas share one responsive, reusable visual
  treatment rather than maintaining separate article-specific styling.
- [ ] Headings, paragraphs, lists, Navigation Nodes, figures, captions, and
  article/image attribution remain readable and visually coherent in the
  shared area.
- [ ] The article surface preserves keyboard-visible Navigation focus and
  usable layouts at narrow and wide viewport sizes.
- [ ] The styling does not change Article Document semantics, Navigation
  behavior, attribution requirements, or the authoritative Duel contract.
- [ ] The boundary between shared article presentation and Duel-specific
  controls is documented well enough for the future Duel screen to reuse it.

## Blocked by

- [`playable-articles/10`](./10-render-typed-article-documents.md)

## Triage note

Ticket 10 intentionally delivered a semantic renderer with minimal visual
assumptions so it could be reused by the Lab. Use the Lab and the intended Duel
layout to settle spacing, typography, figure treatment, attribution placement,
responsive behavior, and the presentation boundary before implementation.
