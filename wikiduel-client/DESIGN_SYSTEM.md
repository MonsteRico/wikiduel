# WikiDuel design system

The visual source of truth is the repository root `aiUIMockups.png`. The system is a restrained dark slate game interface with compact controls and strong player identity.

## Foundations

Design tokens live in `src/index.css` under `@theme`. Use semantic Tailwind names rather than literal color values:

- `canvas`, `surface`, and `surface-raised` establish depth.
- `ink`, `ink-soft`, and `ink-faint` establish text hierarchy.
- `host` is always blue; `opponent` is always red.
- `success`, `warning`, and `danger` communicate state, never player identity.
- `wiki` and `wiki-ink` are reserved for the light article-reading surface during a live Round.
- `line` and `line-soft` provide quiet structure. Avoid high-contrast white borders.

UI chrome uses the condensed `font-display` stack. Long-form application copy uses `font-sans`. Wikipedia article content should use `font-serif` where it matches the source material.

## Shared components

Reusable primitives live in `src/components/ui`:

- `AppShell`: page width, brand header, and responsive outer spacing.
- `Panel`: the standard raised slate surface.
- `Button`: primary, secondary, ghost, and danger actions with shared focus/disabled behavior.
- `PlayerAvatar`: host/opponent identity treatment.
- `StatusIndicator`: semantic connection and state feedback.
- `Icons`: small, stroke-consistent code-native interface icons.

Feature components should compose these primitives. Add a variant to a primitive when the same visual pattern appears twice; do not copy long utility strings between screens.

## Playable Article area

`PlayableArticleArea` is the shared visual boundary for rendering a Playable Article inside the Lab and future Duel screen. It owns the Duel-like article frame, compact current-article header, light reading canvas, responsive figure treatment, typography, and attribution presentation. It composes the semantic `ArticleDocumentRenderer`; it must not own Lab diagnostics, WebSocket transport, authoritative Duel state, Navigation validation, or Duel-specific controls.

The surrounding feature supplies the current `PlayableArticle` and handles `onNavigate`. During a Duel, HUD, target, timer, path, and leave controls should live outside this boundary so the same article presentation can be reused without changing Article Document semantics.

## Composition rules

- Keep the interface compact and readable at 1024px and wider; mobile support should collapse into one deliberate vertical flow.
- Prefer one strong panel or open layout region over nested card grids.
- Keep radii small, shadows cool and subtle, and borders one pixel.
- Uppercase is for short labels and actions, not paragraphs.
- Host and Opponent colors must remain stable across HUDs, route comparisons, results, and summaries.
- During live play, the opponent's current article, route, and distance remain hidden. The visual system must not imply otherwise.
- Motion is brief and structural. Always preserve `prefers-reduced-motion` behavior.
