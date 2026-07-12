## Agent skills

### Ticket tracker

Tickets and specs are tracked as local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map to local statuses; `completed` is this tracker's terminal ticket status. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.

### Accessing GitHub CLI from Codex on Windows

Authenticated `gh` commands must run with host-level/escalated access when
invoked by Codex. The default Codex sandbox runs as a separate service account
and cannot access the interactive Windows user's keyring, so sandboxed
`gh auth status` may report an invalid token even when the user's normal
PowerShell session is authenticated.

Before using `gh` for GitHub API or pull-request operations, run these checks
with host-level access:

```powershell
gh auth status
gh repo view --json nameWithOwner,defaultBranchRef,url
```

Use the Windows keyring credential established by `gh auth login`; do not copy
the token into the workspace, print it, or set `GH_TOKEN`/`GITHUB_TOKEN` as a
workaround. If host-level access is unavailable, ask the user rather than
requesting or handling the token directly.

### Opening pull requests on Windows

Use the following publishing order for this repository:

1. Push the feature branch with local Git. When running in a sandbox, request
   host-level escalation so Git can reach the network and Windows Credential
   Manager:
   `git push -u origin <branch>`.
2. Prefer the connected GitHub app to create the pull request.
3. If the GitHub app returns `403 Resource not accessible by integration`, use
   host-level `gh` only after `gh auth status` succeeds there. A stale or
   inaccessible sandbox credential does not mean the Windows Git credential is
   invalid.
4. If `gh` is unavailable or unauthenticated but Git push succeeds, create the
   pull request with GitHub's REST API using the credential returned by
   `git credential fill`. Keep the credential in a PowerShell variable, send it
   as a Bearer token to `POST /repos/<owner>/<repo>/pulls`, and discard it when
   the process exits. Never print the token, write it to the workspace, or
   include it in tool output.
5. After the pull request exists, add its link to the local ticket's `Completed:`
   line when applicable, commit that tracker update, and push again.

Pull requests should include a summary, rationale, user/developer impact, and
the validation commands that passed. Open a draft unless the user explicitly
requests a ready-for-review pull request.

### Efficient local workflow

- Start with `rtk git status --short --branch` and preserve unrelated working-tree changes.
- Prefer `rtk rg --files` and targeted `rtk rg`/line-range reads. Avoid dumping several large files at once; truncated output usually causes slower follow-up reads.
- Batch related edits into one `apply_patch` call per logical slice instead of making many small patches.
- Parallelize independent read-only inspections and focused test commands when possible.
- During implementation, run the smallest relevant test file and typecheck. Run `npm test`, build, and lint once after the feature is stable.
