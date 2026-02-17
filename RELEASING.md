# Releasing

This repo publishes `codebase-context` to npm.

## How it works

- Merge PRs to `master` with conventional commit messages (`feat:`, `fix:`, etc.)
- Release Please bot opens/updates a release PR automatically
- When you merge the release PR, it publishes to npm with provenance

## Setup (one-time)

**1. Configure npm Trusted Publisher:**
- Go to https://www.npmjs.com/package/codebase-context/access
- Add GitHub Actions trusted publisher:
  - Organization: `PatrickSys`
  - Repository: `codebase-context`
  - Workflow: `release-please.yml`
  - Environment: (leave empty)

That's it! No tokens, no rotation, just OIDC.

**2. Allow Release Please to work:**
- GitHub Settings > Actions > General
- Enable "Read and write permissions"
- Enable "Allow GitHub Actions to create and approve pull requests"

## Releasing

1. Merge PRs to master
2. Wait for release PR to appear
3. Merge the release PR
4. Done - package is published with provenance

## Verify

```bash
npm view codebase-context@X.Y.Z
npm view codebase-context@X.Y.Z --json | jq .dist.attestations
```

## Troubleshooting

If publish fails, check:
- Node 24+ in workflow (required for npm Trusted Publishers)
- `id-token: write` permission in workflow
- `registry-url` is set in setup-node
- Trusted publisher config matches exactly on npmjs.com

**Release Please didn't create a release after merging a "chore: release X.Y.Z" PR:**  
The bot only creates a release when you merge **its own** PR (from branch `release-please--branches--master--...`). It also skips if it finds "No user facing commits" since the last release (it treats merge commits like `chore: release 1.6.2 (#34)` as non–user-facing). So: merge **feature/fix PRs** to master with conventional commits first; let the bot open "chore(master): release X.Y.Z"; then merge **that** PR to tag and publish. If you already merged a manual release PR and no release was created, either push an empty conventional commit to trigger the bot again, or create the tag and GitHub release manually and publish from a local or manual workflow.
