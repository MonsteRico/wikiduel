# Playable Articles PRD

Status: ready-for-agent
Scope: MVP required
Date: 2026-07-04

## Problem Statement

Wiki Duel cannot begin a credible Round until it can turn live English Wikipedia pages into safe, predictable Playable Articles. Wikimedia content is mutable, structurally inconsistent, and untrusted; its raw HTML, links, and media cannot become a browser or gameplay contract. The product also needs to preserve enough editorial structure, imagery, Navigation opportunities, source identity, and attribution for an article to remain readable and legally reusable.

The repository currently has no Wikipedia boundary, Playable Article model, Article Document renderer, article cache, or isolated way to exercise live article behavior. Building these concerns directly into Duel state would make upstream failures and Wikipedia-specific details part of the authoritative game core before the content boundary is understood.

## Solution

Introduce a project-owned, server-side playable-article pipeline that obtains live English Wikipedia data through a swappable Wikipedia Gateway, normalizes it into a typed and allowlisted Article Document, resolves valid Navigation Nodes, retains mandatory attribution, and caches complete immutable Playable Articles for the server process lifetime.

Deliver a development-only Playable Article Lab as the feature's highest end-to-end acceptance surface. A developer can request a title, receive the result through the application's shared WebSocket transport, render it with the production Article Document renderer, follow Navigation Nodes, inspect safe diagnostics, and reproduce unusual live articles without requiring a Duel to exist. The Lab and its preview command are unavailable in production, while the repository, gateway, model, and renderer remain reusable by future Duel integration.

## User Stories

1. As a player, I want a requested Wikipedia title to resolve to one canonical Playable Article, so that redirects do not create fake extra Navigations.
2. As a player, I want article headings and paragraphs to remain readable, so that I can understand the page while racing.
3. As a player, I want ordinary ordered and unordered lists to retain their structure, so that list-based prose does not collapse into confusing text.
4. As a player, I want meaningful strong and emphasized text to survive normalization, so that important editorial distinctions remain visible.
5. As a player, I want valid internal article links to appear as Navigation Nodes, so that I can choose a route through Wikipedia.
6. As a player, I want valid links inside image captions to remain Navigation Nodes, so that legitimate routes are not removed merely because they occur in a caption.
7. As a player, I want unsupported links to remain readable as plain text, so that prose is not damaged by the loss of interactivity.
8. As a player, I want redirects to resolve inside one Navigation, so that redirect mechanics do not alter my click count.
9. As a player, I want ordinary article images and captions to appear near their source position, so that long pages retain useful visual context.
10. As a player, I want decorative and interface images omitted, so that article content is not overwhelmed by irrelevant media.
11. As a player, I want a failed article fetch to leave my current article and path unchanged, so that upstream problems do not create false gameplay progress.
12. As a player, I want article content to contain no executable upstream markup, so that viewing a live page cannot run untrusted code.
13. As a player, I want article and image attribution to be available in the rendered experience, so that reused Wikimedia content is credited appropriately.
14. As a player, I want article loads to finish or fail within a bounded period, so that the interface does not wait forever on Wikimedia.
15. As a player, I want repeated article visits to load from memory when available, so that revisiting a page does not require unnecessary upstream work.
16. As a developer, I want Duel code to depend only on a Playable Article Repository, so that Wikimedia and package details do not enter authoritative game rules.
17. As a developer, I want the Wikipedia package and direct Wikimedia calls hidden behind one gateway, so that the upstream client remains replaceable.
18. As a developer, I want package capabilities verified rather than assumed, so that redirects, limits, continuation, cancellation, and errors behave predictably.
19. As a developer, I want direct Wikimedia requests used only when the package cannot satisfy the contract, so that the integration remains small and maintainable.
20. As a developer, I want candidate links classified by one deterministic policy, so that adding a later exclusion does not reshape the rest of the pipeline.
21. As a developer, I want links batch-resolved before rendering, so that every interactive Navigation Node is already known to be playable.
22. As a developer, I want destination bodies fetched only when selected, so that resolving one article does not recursively download Wikipedia.
23. As a developer, I want deterministic failures represented as stable typed outcomes, so that clients need not understand package-specific errors.
24. As a developer, I want concurrent requests coalesced, so that simultaneous requests for one title do not duplicate expensive upstream work.
25. As a developer, I want complete successful articles cached atomically, so that no caller can observe or reuse a partial build.
26. As a developer, I want a development-only Lab that exercises the real WebSocket path, so that the future Duel integration reuses a proven transport and renderer.
27. As a developer, I want Lab diagnostics separated from the Playable Article contract, so that debugging data cannot leak into production projections.
28. As a developer, I want reported strange articles reducible to small regression fixtures, so that upstream oddities are fixed once and kept fixed.
29. As an operator, I want live Wikimedia access to require a compliant identifying User-Agent before the server accepts connections, so that a deployment cannot accidentally violate upstream policy.
30. As an operator, I want rate limits and upstream pressure treated distinctly from missing content, so that transient infrastructure conditions remain diagnosable and retryable.
31. As an operator, I want concise warnings for final failures and optional debug detail for retries and cache behavior, so that article diagnostics do not bury other server logs.
32. As a maintainer, I want infoboxes deferred behind the baseline pipeline, so that common prose can be validated before adding heterogeneous structured content.

## Implementation Decisions

- A Playable Article is an immutable server-produced value containing canonical page identity, source revision metadata, article attribution, a typed Article Document, and the canonical Navigation targets embedded within that document.
- Article identity contains both the canonical Wikipedia page ID and canonical title. The originally requested title belongs to the request/response envelope for redirect diagnostics rather than to canonical identity.
- Raw or sanitized HTML is never the server-to-client article contract. The server parses untrusted Wikipedia HTML and emits only typed allowlisted nodes; the client renders those nodes without arbitrary HTML injection.
- The initial Article Document block vocabulary contains headings, paragraphs, ordered lists, unordered lists, nested list items, and figures. Inline content contains text, strong emphasis, emphasis, and Navigation Nodes.
- The article title is the sole level-one heading. Source heading levels are preserved beneath it while maintaining valid hierarchy.
- Incidental containers and styling are discarded while supported textual descendants are retained. Unsupported semantic content may fall back to safe readable text when that can be extracted without inventing a dedicated node type.
- Scripts, event handlers, references, edit controls, navboxes, hatnotes, infoboxes, data tables, galleries, maps, audio, video, and their unsupported content subtrees do not enter the required Article Document.
- The normalizer must fail with `article-normalization-failed` when it cannot produce meaningful supported textual content. Zero outgoing Navigation Nodes alone does not make an otherwise valid article unplayable.
- A Navigation Node contains its canonical destination page ID and title plus typed inline label content. It contains no executable destination URL.
- Candidate internal links are resolved and classified during Article Document construction using batched metadata where direct calls are necessary. Destination article bodies remain lazy and are fetched only after selection.
- One deterministic classifier decides whether resolved metadata becomes a Navigation Node. It accepts existing canonical English Wikipedia namespace-zero pages and rejects disambiguation pages, titles beginning with `List of ` or `Lists of `, standalone calendar years including BC forms, and canonical month-day titles. The policy is intentionally extensible when playtesting exposes further unsuitable classes.
- External, edit, help, file, category, talk, special, search, red, citation, and in-page footnote links remain non-interactive text.
- Figures are discovered structurally in supported article-body markup. The package image list enriches or verifies those figures but does not independently add invisible or unrelated files.
- Images inside excluded subtrees, decorative/interface images, icons, badges, tracking images, math renderings, and other unsupported media are omitted. A rejected image leaves no empty figure.
- Caption content uses the normal inline vocabulary, including valid Navigation Nodes.
- Retained images use Wikimedia-generated thumbnail URLs where available, include dimensions, meaningful alternative text or a caption, a supported image MIME type, and complete image attribution.
- Image source URLs require HTTPS and the exact `upload.wikimedia.org` origin. Protocol-relative, HTTP, data, blob, embedded-credential, redirecting-to-unapproved-origin, and otherwise unrecognized sources are rejected.
- Article and history links are limited to `en.wikipedia.org`. Image description links are limited to `commons.wikimedia.org` or `en.wikipedia.org`. License links must be validated HTTPS URLs. Creator-supplied markup is reduced to safe plain text.
- The production Content Security Policy mirrors the model and permits article images only from self and `https://upload.wikimedia.org`.
- Article attribution requires canonical source URL, revision ID and timestamp, page-history URL, license name and URL, and a notice that Wiki Duel simplified or modified the source. Failure to establish these fields rejects the article. Fetch time is retained as operational metadata but does not determine playability.
- Each image requires a source-description URL, safe creator/credit text when supplied, license name, and license URL. Images with incomplete machine-readable attribution, non-free restrictions, or fair-use restrictions are omitted without rejecting the containing article.
- Attribution fields are part of the production model. The later Duel UI owns their visual treatment, expected at the bottom of the article surface; that placement is outside the required Lab/server pipeline issue boundary.
- `WikipediaGateway` is the private server boundary over upstream data. It exposes page snapshots, resolved link metadata, and image metadata while hiding the `wikipedia` package and any direct Wikimedia calls.
- `PlayableArticleRepository` is the application-facing boundary. It orchestrates fetching, normalization, classification, attribution validation, error mapping, request coalescing, and caching. Duel code and WebSocket handlers do not consume raw Wikimedia or package-specific types.
- The integration is package-first. Use current `wikipedia` package capabilities for page identity, HTML, links, images, and other behavior they satisfy completely. Do not manually reimplement batching already encapsulated by a package operation.
- Package redirect behavior, list limits, continuation, User-Agent propagation, cancellation, and error shapes must be verified. Direct official Wikimedia calls are used only for missing contracts, expected initially around bulk canonical link classification and complete image licensing. Only those direct calls own explicit batching and bounded concurrency.
- The live gateway is English-Wikipedia-specific for the MVP.
- `WIKIMEDIA_USER_AGENT` is required whenever the live gateway is enabled. Environment validation runs before Fastify is constructed or begins accepting WebSocket connections, rejects missing or obviously generic values, and applies the same configured identity to package and direct requests. A non-personal placeholder is documented in server environment examples.
- A Playable Article operation has an initial 15-second total upstream budget. This value may be tuned using Lab evidence.
- Network interruptions and transient upstream `5xx` failures receive at most one retry with short jitter inside the same total budget. Deterministic `4xx`, malformed responses, missing pages, and non-playable classifications are not retried.
- `429` is not automatically retried. It becomes `upstream-rate-limited` with parsed retry timing. Wikimedia maxlag and related back-pressure outcomes remain retryable upstream failures rather than content failures.
- Remaining work is cancelled at the budget deadline when supported. Uncancellable late package results are ignored and never cached.
- Public failures are stable typed values: `invalid-title`, `article-not-found`, `article-not-playable` with a specific classification reason, `upstream-rate-limited`, `upstream-unavailable`, `article-normalization-failed`, and `article-attribution-incomplete`.
- Preview request and response envelopes contain a request ID and requested title. Clients ignore stale responses. Internal causes and stack traces do not enter public messages.
- Cache only successfully completed immutable Playable Articles. Key the primary process-memory cache by canonical page ID and retain normalized requested titles and redirects as aliases.
- Cache entries live until process restart without MVP eviction. Concurrent requests for one normalized title are coalesced through one in-flight operation. Transient failures, missing pages, and non-playable results are not cached initially.
- Cache hit/miss verification primarily uses repository tests and fake-gateway call counts. Optional per-request cache diagnostics are debug-level and disabled during normal operation.
- Client gameplay delivery uses the existing WebSocket transport. There is no public HTTP article endpoint for the MVP. Later Navigation handlers retrieve the destination before committing authoritative state, so a failed retrieval cannot change path or click count.
- A shared application-level WebSocket transport is extracted as a separate `realtime-transport` feature. It owns one connection, status, JSON envelope decoding, typed sending, and feature subscription/dispatch. Lobby, Lab, and future Duel behavior remain feature-specific consumers.
- The Playable Article Lab is development-only on both client and server. Its preview route and command are absent or rejected in production.
- The Lab accepts arbitrary titles, renders through the production Article Document renderer, follows Navigation Nodes through the same preview request flow, and exposes loading, retryable, and terminal failure states.
- The Lab includes a separate diagnostics envelope/panel containing requested versus canonical identity, revision, total build duration, cache outcome, emitted node counts, omitted structure/link/image counts and reasons, image-attribution omission reasons, retry timing, and session Navigation history. It never exposes raw HTML, stack traces, or creator-supplied HTML.
- Infobox support is MVP optional and builds on the same Article Document, classification, attribution, and renderer contracts after the baseline is validated.
- Vitest is the intended test runner for both client and server. React Testing Library and a DOM test environment support focused client component tests.
- Test infrastructure, strengthened Lobby regression coverage, and shared realtime transport extraction are separate enabling issues. Playable-article server work depends on test infrastructure but not on realtime transport; Lab client work depends on both the server pipeline and realtime transport.

## Testing Decisions

- Tests assert external behavior and durable contracts rather than private function layout, current file names, or complete serialized snapshots.
- Pure normalizer tests use representative, malformed, and hostile HTML fixtures. They explicitly assert supported node structure, text fallback, canonical Navigation Nodes, structural image selection, and rejection of scripts, event handlers, unsafe schemes, unsafe origins, malformed markup, SVG/foreign-object attacks, and unsupported subtrees.
- Repository tests use a fake Wikipedia Gateway to exercise redirects, playability classification, attribution policy, atomic cache insertion, aliasing, request coalescing, time budgets, cancellation/late completion, typed failures, and the rule that one rejected image does not reject an otherwise complete article.
- Gateway contract tests stub realistic package and official endpoint responses. They verify User-Agent propagation, response translation, redirects, limits/continuation, cancellation behavior, error mapping, and that package-specific types do not escape the gateway.
- Existing Fastify WebSocket injection is the server integration seam. Tests use a fake repository and the real preview handler/serialization to cover success, every public failure, request IDs, malformed messages, multiple requests on one connection, production gating, and non-regression of existing Lobby messages.
- Client tests cover semantic Article Document rendering, nested lists, safe text escaping, image/figure accessibility, attribution, prose and caption Navigation Nodes, Lab loading/failure/retry behavior, stale-response suppression, and correct canonical destination requests.
- The development-only Playable Article Lab is the highest feature seam. It manually exercises the live package, direct endpoints, gateway, repository, cache, WebSocket, renderer, Content Security Policy, and diagnostics against ordinary and reported-strange articles.
- Live Wikimedia smoke checks are minimal, opt-in, require a configured User-Agent, and remain outside deterministic CI. They verify broad contracts for an ordinary article, redirect, media-rich article, and disambiguation page without asserting mutable prose.
- When the Lab reveals a new upstream shape, add a minimized synthetic regression fixture to the corresponding behavior issue. If source content must be retained, include its source and attribution.
- Do not snapshot complete Article Documents. Use focused assertions that explain which product or security invariant changed.
- Feature issues include the tests for the behavior they introduce. There is no deferred playable-article testing issue.
- Before the shared socket refactor, establish Vitest in both packages and strengthen current Lobby coverage. The realtime transport extraction includes its own lifecycle, parsing, sending, subscription, dispatch, and failure tests.

## Out of Scope

- Production Duel, Round-start, and authoritative Navigation integration beyond contracts designed for reuse
- A production HTTP article endpoint
- Persistent or restart-surviving article caching
- Cache eviction, distributed caching, or multiple server instances
- Exact-revision pinning throughout a Round
- Automatic prompt generation, graph crawling, or route-quality analysis
- Infobox rendering in the required baseline; it is tracked as MVP optional
- Data tables, galleries, maps, audio, and video
- External links as interactive browser destinations
- List, calendar-year, and calendar-date articles as Playable Articles
- Automated semantic detection of every possible list-like article through Wikidata, categories, or probabilistic content analysis
- A reusable fixture-backed complete Duel graph; that remains separately tracked
- Broad two-browser Duel end-to-end automation and accessibility audits; those remain later test-automation work

## Further Notes

- The deterministic playability classifier is deliberately conservative and easy to extend. Playtesting evidence, not speculative taxonomy, should add further exclusions.
- The Playable Article Lab is both the feature outcome and the operational reproduction surface for future content reports. The renderer it hosts is production code; only the surrounding preview route, command, and diagnostics are development-only.
- The existing `wikipedia` package remains an implementation aid rather than a security or domain boundary. Its capabilities must be measured against the contract during implementation.
- Wikimedia HTML and attribution metadata remain untrusted even when obtained through a typed package.
- The complete attribution data belongs to the Playable Article model even though final Duel placement and styling are handled by later UI integration.
