# Fetch and Sanitize Playable Articles

Status: needs-triage
Scope: MVP required
Category: enhancement

## What to build

Turn a requested live English Wikipedia title into a safe, normalized Playable Article containing its canonical title, supported body content, valid Navigation targets, ordinary images and captions, revision/source metadata, and required attribution data.

Use the TypeScript `wikipedia` package behind a project-owned Wikipedia adapter as the initial API client. Confirm that it supplies the required full HTML, canonical/redirect metadata, images, and a meaningful Wikimedia User-Agent. The adapter may call official Wikimedia endpoints directly where the wrapper cannot satisfy the contract.

Treat all returned content as untrusted. Sanitize on the server with a strict allowlist before any content reaches a browser, and cache the safe normalized result in memory for the life of the process.

## Acceptance criteria

- [ ] A valid English main-namespace title resolves to one canonical Playable Article.
- [ ] Redirects resolve without adding an extra Navigation.
- [ ] Headings, paragraphs, ordinary lists, playable internal links, ordinary images, and captions survive normalization.
- [ ] Scripts, event handlers, edit controls, references, navboxes, infoboxes, tables, galleries, maps, audio, video, and unsupported links cannot reach executable browser markup.
- [ ] Each playable link maps to a server-validatable canonical destination; non-playable anchors render as plain text.
- [ ] Only explicitly allowed Wikimedia image origins and safe URL schemes survive sanitization.
- [ ] Article and image attribution data needed by the UI is retained.
- [ ] Requests use a meaningful Wikimedia-compliant User-Agent and handle redirects, missing pages, rate limits, and upstream failures without corrupting active Duel state.
- [ ] A repeated request can use the in-memory cache.

## Blocked by

- None — can start against a small adapter contract before the Duel UI exists.

## Out of scope

- Persistent article caching
- Exact-revision pinning throughout a Round
- Infoboxes, data tables, galleries, maps, audio, or video
- A complete Wikipedia graph or automatic prompt generation

## Comments

- 2026-07-03: The `wikipedia` package is the preferred initial client, not the security boundary. Server-side normalization and sanitization remain project responsibilities.
