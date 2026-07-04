# Issue Tracker: Local Markdown

Issues and PRDs for this repository live as Markdown files under `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<issue-slug>.md`, numbered from `01` within that feature
- Refer to an issue as `<feature-slug>/<NN>`; for example, `damage/01`
- A substantial feature may have `.scratch/<feature-slug>/PRD.md` when its own design needs a durable specification
- A portfolio or release plan may have its own feature directory containing a `PRD.md` and `BACKLOG.md` that link to issues owned by other feature directories
- Triage state is recorded as a `Status:` line near the top of each issue file; see [`triage-labels.md`](./triage-labels.md)
- Product priority may be recorded separately as `Scope: MVP required`, `Scope: MVP optional`, or `Scope: Future`
- Comments and conversation history append to the bottom of an issue under `## Comments`

`Status` and `Scope` are independent. Status describes whether work is sufficiently specified and assignable; Scope describes the product milestone it belongs to.

Keep issues in the same feature when they evolve one coherent capability or lifecycle seam, such as the required Damage Rule and its later tuning. Give a standalone capability its own feature slug. When a feature grows, add another locally numbered issue rather than returning to a repository-wide flat issue directory.

Dependencies should use clickable, feature-qualified references so local issue numbers remain unambiguous.

## Publishing to the issue tracker

When a skill says to publish a PRD or issue, create the corresponding Markdown file under the owning `.scratch/<feature-slug>/`, creating directories as needed. Determine the next issue number from that feature's own `issues/` directory.

New planning stubs normally begin as `needs-triage`. Issues produced from an approved tracer-bullet breakdown may begin as `ready-for-agent` when their behavior, acceptance criteria, scope boundaries, and blockers are complete.

## Fetching a ticket

When a skill says to fetch a relevant ticket, read the referenced local Markdown file. The user will normally provide its path, feature slug and issue number, or direct issue filename.

For Wiki Duel MVP planning, start with:

- [PRD](../../.scratch/wiki-duel-mvp/PRD.md)
- [Scope backlog](../../.scratch/wiki-duel-mvp/BACKLOG.md)
