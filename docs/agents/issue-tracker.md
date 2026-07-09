# Ticket Tracker: Local Markdown

Tickets and specs for this repository live as Markdown files under `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- Implementation tickets are `.scratch/<feature-slug>/tickets/<NN>-<ticket-slug>.md`, numbered from `01` within that feature
- Refer to a ticket as `<feature-slug>/<NN>`; for example, `damage/01`
- A substantial feature may have `.scratch/<feature-slug>/spec.md` when its own design needs a durable specification
- A portfolio or release plan may have its own feature directory containing a `spec.md` and `BACKLOG.md` that link to tickets owned by other feature directories
- Triage state is recorded as a `Status:` line near the top of each ticket file; see [`triage-labels.md`](./triage-labels.md)
- Product priority may be recorded separately as `Scope: MVP required`, `Scope: MVP optional`, or `Scope: Future`
- Comments and conversation history append to the bottom of a ticket under `## Comments`

`Status` and `Scope` are independent. Status describes whether work is sufficiently specified and assignable; Scope describes the product milestone it belongs to.

## Completing a ticket

`completed` is the terminal implementation status for local Markdown tickets; it is documented as a local status in [`triage-labels.md`](./triage-labels.md), not a canonical triage role.

When an implementation fully satisfies a ticket, the implementation branch should:

- change the ticket to `Status: completed`;
- check every acceptance criterion that the implementation satisfies;
- add a `Completed:` line with the approximate local date/time and pull-request link when applicable;
- add a concise implementation note when useful; and
- include that ticket-file change in the implementation pull request.

The completed status describes the repository state that will exist after the pull request merges. Keeping the status change in the same pull request as the implementation lets code, tests, documentation, and tracker state merge atomically; a separate post-merge completion commit is not required.

Use the completion format documented in [`triage-labels.md`](./triage-labels.md). The pull-request link may be added to the same branch immediately after the pull request is opened.

Do not mark a ticket completed merely because implementation started or a pull request exists. If acceptance criteria remain unmet, validation is failing, or material work is deferred, keep the ticket in its existing open-work state and document what remains.

If a completed ticket must be reopened, normally return it to `needs-triage` so the changed requirement or regression can be evaluated before reassignment. A maintainer may explicitly choose another open-work status.

Keep tickets in the same feature when they evolve one coherent capability or lifecycle seam, such as the required Damage Rule and its later tuning. Give a standalone capability its own feature slug. When a feature grows, add another locally numbered ticket rather than returning to a repository-wide flat ticket directory.

Dependencies should use clickable, feature-qualified references so local ticket numbers remain unambiguous.

## Publishing to the ticket tracker

When a skill says to publish a spec or ticket, create the corresponding Markdown file under the owning `.scratch/<feature-slug>/`, creating directories as needed. Determine the next ticket number from that feature's own `tickets/` directory.

New planning stubs normally begin as `needs-triage`. Tickets produced from an approved tracer-bullet breakdown may begin as `ready-for-agent` when their behavior, acceptance criteria, scope boundaries, and blockers are complete.

## Fetching a ticket

When a skill says to fetch a relevant ticket, read the referenced local Markdown file. The user will normally provide its path, feature slug and ticket number, or direct ticket filename.

For Wiki Duel MVP planning, start with:

- [spec](../../.scratch/wiki-duel-mvp/spec.md)
- [Scope backlog](../../.scratch/wiki-duel-mvp/BACKLOG.md)
