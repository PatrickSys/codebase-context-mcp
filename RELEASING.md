# Releasing

This repo publishes an npm package: `codebase-context`.

We use a clean OSS-style flow:

- PRs merge into `master` (nothing publishes on merge)
- A release is created by a dedicated **Release PR** opened/updated automatically
- When the Release PR is merged, CI creates a git tag like `v1.2.3`
- Tag pushes trigger CI to publish to npm

## One-time setup (maintainers)

1. Add a repository secret: `NPM_TOKEN`
   - Create an npm access token with publish rights for `codebase-context`
   - Add it in GitHub: Settings > Secrets and variables > Actions > New repository secret
   - If your npm tokens expire (for example after 90 days), rotate the token and update this secret before it expires

2. (Recommended) Protect `master`
   - Require PRs (no direct pushes)
   - Require the `Tests` workflow to pass

3. Allow Release Please to open PRs
   - GitHub: Settings > Actions > General
   - Set Workflow permissions to "Read and write"
   - Enable "Allow GitHub Actions to create and approve pull requests"

## Normal release flow

1. Merge changes into `master` via PRs.
   - Recommended: use **Squash and merge** so the PR title becomes the commit message.
   - Release automation relies on Conventional-Commits style messages like `feat: ...` / `fix: ...`.

2. Wait for the bot PR named like `release-please--branches--master`.
   - It bumps `package.json` and updates `CHANGELOG.md`
   - If it already exists, it gets updated automatically as new PRs merge

3. When you're ready to ship, merge the Release PR.
   - This creates a git tag `vX.Y.Z` and a GitHub Release
   - The `Publish` workflow runs on the tag and publishes to npm

## Notes

- Publishing is triggered only by `v*` tags.
- The publish workflow verifies `tag == v${package.json.version}` and fails fast if they don't match.
