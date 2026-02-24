# Docs assets

This folder holds images and GIFs used in the README and docs. Add the following files so links render correctly.

**Full audit and Reddit/distribution plan:** [MARKETING-AND-VISUALS.md](../MARKETING-AND-VISUALS.md).

## Required assets

| File                    | Purpose                          | Spec                                                                                                                                                                                                                                                                                           |
| ----------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo.gif`              | README hero (above the fold)     | One search: `search_codebase("How does this app attach the auth token to outgoing API calls?", intent: "edit")` → AuthInterceptor (or equivalent) top result + preflight. **&lt;15s.** Cursor or Claude Code + MCP, or CLI. Record against angular-spotify (or same repo) for reproducibility. |
| `preflight-example.png` | Proof of "checks before editing" | Preflight JSON or styled card: `ready: false`, `nextAction` (e.g. "2 of 5 callers aren't in results"), `patterns.do` / `patterns.avoid` with %, `whatWouldHelp` (1–2 steps). Used in README next to preflight JSON or in "Checks before editing".                                              |
| `cli-search.png`        | CLI / scripters                  | Terminal: `npx codebase-context search --query "auth interceptor" --intent edit` with truncated JSON (results + preflight). Place in CLI Reference or a "Try it in 30 seconds" line.                                                                                                           |

## Optional

| File                      | Purpose                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `semantic-vs-keyword.png` | Side-by-side: query "skip to next song" → grep (no/useless match) vs codebase-context (correct file). For "How the search works" or a short "Why semantic + intent" blurb. |

## Reproducibility

README caption for the demo: _"One search returns code, patterns, and preflight. Recorded against angular-spotify."_ Use the same or a similar public repo so readers can reproduce.

Do not gitignore this directory; the assets are part of the public docs.

Here's what's done and what you need to do

What I built (all compiles, all tests pass):

Pretty CLI formatters — the patterns, search, and refs commands now output clean structured text instead of raw JSON. This is
the difference between "nobody screenshots this" and "this looks like a real tool."

Suppressed debug noise — no more [search] Loaded pattern intelligence... cluttering the output.

Fixed bugs — 100%% adoption double-percent gone.

README/CHANGELOG/docs — all rewritten for humans, not robots.

Post drafts — 6 subreddits + HN, all saved in docs/MARKETING-AND-VISUALS.md.

What YOU need to do (15-20 minutes):

1. Take 2 terminal screenshots — these are your proof:

# Screenshot A (the money shot — patterns with adoption % and trends)

CODEBASE_ROOT=C:\Users\bitaz\Repos\angular-spotify node dist/index.js patterns 2>nul

# Screenshot B (search with decision card)

CODEBASE_ROOT=C:\Users\bitaz\Repos\angular-spotify node dist/index.js search --query "how does auth work" --intent edit 2>nul

1. Save to docs/assets/, uncomment the README image.
2. Commit + publish:
   git add src/ README.md CHANGELOG.md docs/ package.json
   git commit -m "docs: launch prep — CLI formatters, README rewrite, CHANGELOG cleanup"
   npm version patch && npm publish
3. Post r/ClaudeAI — Thursday evening 6-9pm ET. Title A from docs/MARKETING-AND-VISUALS.md. Replace [Screenshot A] and  
   [Screenshot B] with your actual images.
4. Submit to registries — the 6 URLs are in docs/MARKETING-AND-VISUALS.md. One-time work, passive discovery forever.

The code is ready. The posts are written. The screenshots are the last gate.
