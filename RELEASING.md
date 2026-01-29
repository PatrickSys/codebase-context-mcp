# Releasing

This repo publishes an npm package: `codebase-context`.

We use a clean OSS-style flow:

- PRs merge into `master` (nothing publishes on merge)
- A release is created by a dedicated **Release PR** opened/updated automatically
- When the Release PR is merged, CI creates a git tag like `v1.2.3`
- npm publish happens automatically in the same workflow run
- Packages are published with provenance attestations (supply chain security)

## One-time setup (maintainers)

### 1. Configure npm Trusted Publisher (Provenance)

On npmjs.com:
1. Navigate to https://www.npmjs.com/package/codebase-context/access
2. Scroll to "Publishing access" → "Trusted publishers"
3. Configure GitHub Actions:
   - Organization: PatrickSys
   - Repository: codebase-context
   - Workflow: release-please.yml
   - Environment: (leave empty)

This enables OIDC authentication and automatic provenance generation.
No NPM_TOKEN needed! No token rotation!

### 2. (Recommended) Protect `master`

- Require PRs (no direct pushes)
- Require the `Tests` workflow to pass

### 3. Allow Release Please to open PRs

GitHub: Settings > Actions > General
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
   - The `Release Please` workflow publishes to npm as part of the same run
   - Provenance attestation is generated automatically

## Verifying a release

After merging a release PR:

1. Check GitHub Actions workflow completed successfully
2. Verify package on npm: `npm view codebase-context@X.Y.Z`
3. Verify provenance: `npm view codebase-context@X.Y.Z --json | jq .dist`
4. Check for `attestations` field in npm package metadata
5. Verify tag exists: `git fetch --tags && git tag | grep vX.Y.Z`

## Troubleshooting

**"Version already published" in workflow logs**
- This is normal behavior (idempotency protection)
- The version was already published successfully

**Workflow fails at "Quality gates"**
- Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test` locally
- Fix issues and push to the release PR branch
- Workflow will re-run automatically

**Provenance not appearing**
1. Verify trusted publisher configuration on npmjs.com matches exactly:
   - Organization: PatrickSys (case-sensitive)
   - Repository: codebase-context
   - Workflow: release-please.yml
2. Check workflow has `id-token: write` permission
3. Verify npm CLI version ≥ 11.5.1 in workflow logs
4. Ensure `--provenance` flag is in publish command

## Legacy: NPM_TOKEN (no longer needed)

npm Trusted Publishers uses OIDC authentication. No token management required.

If you need to use a token (e.g., for local testing):
1. Create an npm access token with publish rights
2. Add it as GitHub secret: `NPM_TOKEN`
3. Add to workflow: `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`
4. Tokens expire every 90 days and must be rotated

**Not recommended for production workflows in 2026.**
