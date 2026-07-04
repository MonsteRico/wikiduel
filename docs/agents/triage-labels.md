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

When marking an issue as completed, check the acceptance criteria within it, track the Completed date/approximate time, and include via what PR if applicable. When including time you may ignore the seconds and the time zone offset, do however include AM/PM Example: `Completed: 2026-07-04 02:30 AM via [PR #1](https://github.com/MonsteRico/wikiduel/pull/1)`

Every triaged issue should use exactly one of these states. Product scope such as `MVP required`, `MVP optional`, or `Future` belongs in a separate `Scope:` field and never substitutes for triage state.

When a skill mentions a canonical role, use the matching local status from this table.
