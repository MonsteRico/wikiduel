## Agent skills

### Issue tracker

Issues and PRDs are tracked as local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Issue states use the six canonical role names. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.

### Opening pull requests on Windows

Use the following publishing order for this repository:

1. Push the feature branch with local Git. When running in a sandbox, request
   escalation so Git can reach the network and Windows Credential Manager:
   `git push -u origin <branch>`.
2. Prefer the connected GitHub app to create the pull request.
3. If the GitHub app returns `403 Resource not accessible by integration`, try
   `gh` only when `gh auth status` succeeds. A stale `gh` token does not mean
   the Windows Git credential is invalid.
4. If `gh` is unavailable or unauthenticated but Git push succeeds, create the
   pull request with GitHub's REST API using the credential returned by
   `git credential fill`. Keep the credential in a PowerShell variable, send it
   as a Bearer token to `POST /repos/<owner>/<repo>/pulls`, and discard it when
   the process exits. Never print the token, write it to the workspace, or
   include it in tool output.
5. After the pull request exists, add its link to the local issue's `Completed:`
   line when applicable, commit that tracker update, and push again.

Pull requests should include a summary, rationale, user/developer impact, and
the validation commands that passed. Open a draft unless the user explicitly
requests a ready-for-review pull request.
