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

## Completing an issue

`completed` is the terminal implementation status for local Markdown issues and one of the canonical issue roles documented in [`triage-labels.md`](./triage-labels.md).

When an implementation fully satisfies an issue, the implementation branch should:

- change the issue to `Status: completed`;
- check every acceptance criterion that the implementation satisfies;
- add a `Completed:` line with the approximate local date/time and pull-request link when applicable;
- add a concise implementation note when useful; and
- include that issue-file change in the implementation pull request.

The completed status describes the repository state that will exist after the pull request merges. Keeping the status change in the same pull request as the implementation lets code, tests, documentation, and tracker state merge atomically; a separate post-merge completion commit is not required.

Use the completion format documented in [`triage-labels.md`](./triage-labels.md). The pull-request link may be added to the same branch immediately after the pull request is opened.

Do not mark an issue completed merely because implementation started or a pull request exists. If acceptance criteria remain unmet, validation is failing, or material work is deferred, keep the issue in its existing open-work state and document what remains.

If a completed issue must be reopened, normally return it to `needs-triage` so the changed requirement or regression can be evaluated before reassignment. A maintainer may explicitly choose another open-work status.

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
