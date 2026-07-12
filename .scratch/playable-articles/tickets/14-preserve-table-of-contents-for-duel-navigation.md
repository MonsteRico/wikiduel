> *This was generated from the Playable Article Lab follow-up request.*

# Preserve Wikipedia Table of Contents for Duel Navigation

Status: needs-triage
Scope: MVP required
Category: enhancement

## Parent

- [`playable-articles/10`](./10-render-typed-article-documents.md)
- [Playable Articles spec](../spec.md)

## Problem

Quick Lab checks show that a Wikipedia page's table of contents can be included
in the rendered Article Document text. This adds navigation chrome to the
article body and makes it unclear which content is available for the actual
race.

## What to build

Investigate how Wikipedia table-of-contents structures arrive at the
normalizer, remove the table of contents from rendered article body text, and
preserve a server-owned representation that the Duel screen can use as a quick
way to jump to headings in the current article. A table-of-contents jump must
not become a Navigation or count as a race click.

## Acceptance criteria

- [ ] The triage investigation identifies the upstream structures that produce
  the table of contents and the current leakage path.
- [ ] Rendered Article Document body content excludes table-of-contents labels,
  links, and surrounding presentation chrome without removing real article
  content.
- [ ] The retained table of contents has a typed or otherwise explicit contract
  that the Duel screen can consume for same-article heading jumps.
- [ ] A table-of-contents jump does not create a Navigation, change the
  authoritative article path, or increment the race click count.
- [ ] Nested headings, missing or malformed entries, accessibility, and
  headings removed by normalizer policy are covered by the implementation plan
  and regression fixtures.

## Blocked by

- [`playable-articles/10`](./10-render-typed-article-documents.md)

## Triage note

This is intentionally a planning ticket rather than a settled implementation
design. Triage should decide the representation, ownership between normalizer
and renderer, heading-link identity policy, and how a same-article jump is
delivered to the future Duel screen before moving it to ready-for-agent.
