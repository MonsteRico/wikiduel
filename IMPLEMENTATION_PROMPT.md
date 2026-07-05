# Implementation Prompt

Use this prompt in a fresh chat for an issue that has already been planned and marked `ready-for-agent`.

```text
Begin /implement for:

Issue: [ISSUE LINK]
Parent PRD: [PRD LINK, or "none"]
Base branch: [main or dependency branch]
Active parallel work: [none, or list each active issue, branch, and ownership area]

This issue has already been planned and marked ready-for-agent. Do not run
/triage or reopen settled product decisions without concrete contradictory
evidence.

Work in a separate worktree on branch:

codex/[issue-slug]

You may install node_modules inside this worktree as necessary. Do not upgrade
or add dependencies unless required by the issue, and do not modify global
development tooling.

Before editing, perform a brief readiness audit:

1. Read the complete issue, parent PRD, CONTEXT.md, relevant ADRs, dependency
   issues, and the current implementation.
2. Confirm every listed blocker is merged into or otherwise present on the
   specified base branch.
3. Identify the highest practical test seam and the first behavior to drive
   through TDD.
4. Report the modules or areas likely to change and whether they overlap with
   any listed parallel work.
5. Check that the issue remains consistent with the current codebase.

If you find an unmet blocker, stale assumption, ADR/domain conflict, missing
product decision, or material overlap with active parallel work, stop and ask
before changing code. Do not speculate about alternative designs merely to
reopen decisions already resolved by the issue and PRD.

Implementation rules:

- Follow /implement and its internal /tdd workflow.
- Work in small red-green-refactor slices.
- Test observable behavior through the highest practical seam.
- Keep the change within the issue's acceptance criteria and explicit scope.
- Preserve unrelated user changes and avoid opportunistic refactors.
- If adjacent work is useful but not required, propose a follow-up issue
  instead of silently expanding scope.
- If a newly discovered requirement changes product behavior, architecture,
  security policy, or the domain model, stop and ask.
- Maintain canonical terminology from CONTEXT.md.
- Update durable documentation or ADRs only when the implementation resolves
  or changes something that belongs there.

Commits:

- You may create coherent incremental commits as work progresses.
- Each commit should represent an understandable behavioral or structural
  milestone.
- Relevant focused tests should pass at every commit.
- Avoid knowingly broken, WIP-only, or cleanup-noise commits.
- Do not rewrite or integrate another agent's branch without explicit
  direction.

Parallel-work safety:

- Assume implementation is sequential unless "Active parallel work" lists
  another issue.
- Separate worktrees prevent filesystem collisions, but do not prevent merge
  or architectural conflicts.
- If parallel work touches the same modules, contracts, package manifests,
  routes, providers, or central configuration, stop and report the overlap.
- Prefer injected or in-memory servers, or ephemeral port 0, for tests.
- If a fixed development port is necessary, select an explicitly unoccupied
  port and report it before starting the server.
- Never terminate or modify processes belonging to another worktree.

Before opening the PR:

1. Confirm every acceptance criterion with evidence.
2. Run /implement's Standards and Spec review against the final diff, issue,
   PRD, glossary, and ADRs.
3. Fix review findings and repeat relevant tests.
4. Run all focused tests for the changed behavior.
5. Run the complete client and server validation suites required by the repo,
   including tests, type-checks, builds, and lint where available.
6. Inspect the final diff for unrelated changes, secrets, generated artifacts,
   accidental dependency updates, debug logging, and missing documentation.
7. Check whether the base branch changed materially. If reconciliation would
   create conflicts or alter another agent's work, stop and ask rather than
   resolving it speculatively.

When complete:

- Confirm every acceptance criterion is satisfied.
- Change the local Markdown issue to `Status: completed` within this branch.
- Check every acceptance-criteria box satisfied by the implementation and add
  a concise implementation note when useful.
- Add a `Completed:` line using the repository's documented local date/time
  format. Include the pull-request link when it is available.
- Commit the issue-state change as part of the implementation PR so code,
  tests, documentation, and tracker state merge atomically.
- Push the implementation branch.
- Open a PR containing:
  - a concise behavioral summary;
  - acceptance criteria addressed;
  - tests and validation commands run;
  - architectural or dependency changes;
  - known risks and proposed follow-up issues.
- If the pull-request URL was not known when the issue was first marked
  completed, update its `Completed:` line with that link and push the tracker
  update to the same PR branch.

Only mark the issue completed after implementation, review, and all required
validation succeed. If the work is partial or knowingly incomplete, leave it
ready-for-agent and explain what remains.

The completed status describes the state that will exist after the PR merges;
it is expected for the issue to read completed on the PR branch while awaiting
human review and merge.

If you encounter an unresolved question at any point, stop and ask rather than
making a product or architectural decision implicitly.
```
