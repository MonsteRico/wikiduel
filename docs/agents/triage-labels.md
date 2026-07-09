# Triage Labels

The engineering skills use five canonical triage roles. Local Markdown tickets record the corresponding value in their `Status:` line.

| Canonical triage role | Local status | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | A maintainer still needs to evaluate or refine the ticket |
| `needs-info` | `needs-info` | The ticket is waiting for additional information |
| `ready-for-agent` | `ready-for-agent` | The ticket is fully specified and can be completed by an AFK agent |
| `ready-for-human` | `ready-for-human` | The ticket requires human implementation or judgment |
| `wontfix` | `wontfix` | The ticket will not be actioned |

Every open triaged ticket should use exactly one of these states. Product scope such as `MVP required`, `MVP optional`, or `Future` belongs in a separate `Scope:` field and never substitutes for triage state.

When a skill mentions a canonical role, use the matching local status from this table.

## Completed tickets

`completed` is this repository's terminal local status, not a canonical triage role. Use `Status: completed` only after implementation, review, and validation satisfy the full ticket. The implementation pull request should replace the open-work status with `completed`, check the satisfied acceptance criteria, and carry the tracker update alongside the code and tests. This represents the intended post-merge state even while the pull request is awaiting human review.

Record the approximate completion time and pull request when applicable using:

```markdown
Completed: 2026-07-04 02:30 AM via [PR #1](https://github.com/MonsteRico/wikiduel/pull/1)
```

Seconds and the timezone offset may be omitted, but include AM/PM.

Do not use `completed` for partial implementations, open pull requests that still have known required work, or tickets whose validation is failing. Reopened completed work normally returns to `needs-triage` unless a maintainer explicitly selects another state.
