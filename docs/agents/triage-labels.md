# Triage Labels

The engineering skills use six canonical issue roles. Local Markdown issues record the corresponding value in their `Status:` line.

| Canonical role | Local status | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | A maintainer still needs to evaluate or refine the issue |
| `needs-info` | `needs-info` | The issue is waiting for additional information |
| `ready-for-agent` | `ready-for-agent` | The issue is fully specified and can be completed by an AFK agent |
| `ready-for-human` | `ready-for-human` | The issue requires human implementation or judgment |
| `wontfix` | `wontfix` | The issue will not be actioned |
| `completed` | `completed` | The issue's acceptance criteria have been met and its implementation is complete |

Every triaged issue should use exactly one of these states. Product scope such as `MVP required`, `MVP optional`, or `Future` belongs in a separate `Scope:` field and never substitutes for triage state.

When a skill mentions a canonical role, use the matching local status from this table.

## Completed implementation

Use `Status: completed` only after implementation, review, and validation satisfy the full issue. The implementation pull request should replace the open-work status with `completed`, check the satisfied acceptance criteria, and carry the tracker update alongside the code and tests. This represents the intended post-merge state even while the pull request is awaiting human review.

Record the approximate completion time and pull request when applicable using:

```markdown
Completed: 2026-07-04 02:30 AM via [PR #1](https://github.com/MonsteRico/wikiduel/pull/1)
```

Seconds and the timezone offset may be omitted, but include AM/PM.

Do not use `completed` for partial implementations, open pull requests that still have known required work, or issues whose validation is failing. Reopened completed work normally returns to `needs-triage` unless a maintainer explicitly selects another state.
