# Playable Article Lab scenarios

The Playable Article Lab is development-only. Start the client and server with a
configured `WIKIMEDIA_USER_AGENT`, then open `/lab` in the Vite development
server. The Lab uses the same WebSocket transport and Article Document renderer
as the application boundary.

Manual scenarios:

- Ordinary article: request `Ada Lovelace`; verify the canonical title, prose,
  attribution, node counts, the `Open on Wikipedia` source link, and a
  successful cache hit when it is requested a second time.
- Redirected article: request `USA`; verify that the rendered identity is
  `United States` and that the requested and canonical titles remain distinct
  in Diagnostics.
- Media-rich article: request `Cat`; verify that safe figures, captions,
  image attribution, and caption Navigation Nodes remain usable.
- Disambiguation article: request `Mercury`; verify the typed terminal failure
  keeps the last valid article visible and explains that the page is not
  playable.
- Reported-strange article: request the title from the current content report;
  record the requested/canonical identity, revision, omission reasons, expanded
  omission examples, cache outcome, and timing from Diagnostics. Use the
  source link to compare the live page, then reduce any new shape to a small
  fixture before changing the normalizer. Omission examples are bounded safe
  subjects and reasons; the Lab never exposes upstream HTML.

These checks are intentionally manual and exploratory. The opt-in live smoke
suite is enabled only with `WIKIMEDIA_LIVE_SMOKE=1` and a configured
`WIKIMEDIA_USER_AGENT`; it is skipped by deterministic CI.

To add one reported-strange title to the opt-in smoke run, also set
`WIKIMEDIA_LIVE_SMOKE_REPORTED_TITLE` to the title currently being investigated.
