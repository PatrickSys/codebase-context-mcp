# Changelog

## 1.2.1 (2025-12-31)

### Fixed

- **MCP Protocol Compatibility**: Fixed stderr output during MCP STDIO handshake for strict clients
  - All startup `console.error` calls now guarded with `CODEBASE_CONTEXT_DEBUG` env var
  - Zero stderr output during JSON-RPC handshake (required by Warp, OpenCode, MCPJam)
  - Debug logs available via `CODEBASE_CONTEXT_DEBUG=1` environment variable
  - Minimal implementation: 2 files changed, 46 insertions, 25 deletions
  - Reported by [@aolin480](https://github.com/aolin480) in [#2](https://github.com/PatrickSys/codebase-context/issues/2)

## 1.2.0 (2025-12-29)

### Features

- **Actionable Guidance**: `get_team_patterns` now returns a `guidance` field with pre-computed decisions:
  - `"USE: inject() – 97% adoption, stable"`
  - `"AVOID: constructor DI – 3%, declining (legacy)"`
- **Pattern-Aware Search**: `search_codebase` results now include:
  - `trend`: `Rising` | `Stable` | `Declining` for each result
  - `patternWarning`: Warning message for results using declining patterns
- **Search Boosting**: Results are re-ranked based on pattern modernity:
  - +15% score boost for Rising patterns
  - -10% score penalty for Declining patterns

### Purpose

This release addresses **Search Contamination** — the proven problem where AI agents copy legacy code from search results. By adding trend awareness and actionable guidance, AI agents can now prioritize modern patterns over legacy code.

## 1.1.0 (2025-12-15)

### Features

- **Pattern Momentum**: Detect migration direction via git history. Each pattern in `get_team_patterns` now includes:
  - `newestFileDate`: ISO timestamp of the most recent file using this pattern
  - `trend`: `Rising` (≤60 days), `Stable`, or `Declining` (≥180 days)
- This solves the "3% Problem" — AI can now distinguish between legacy patterns being phased out vs. new patterns being adopted

### Technical

- New `src/utils/git-dates.ts`: Extracts file commit dates via single `git log` command
- Updated `PatternDetector` to track temporal data per pattern
- Graceful fallback for non-git repositories

## 1.0.1 (2025-12-11)

### Fixed

- Added `typescript` as runtime dependency (required by `@typescript-eslint/typescript-estree`)

## 1.0.0 (2025-12-11)

Initial release.

### Features

- **Semantic search**: Hybrid search combining semantic similarity with keyword matching
- **Pattern detection**: Detects team patterns (DI, signals, standalone) with usage frequencies
- **Golden Files**: Surfaces files that demonstrate all team patterns together
- **Internal library discovery**: Tracks usage counts per library, detects wrappers
- **Testing framework detection**: Detects Jest, Jasmine, Vitest, Cypress, Playwright from actual code
- **Angular analyzer**: Components, services, guards, interceptors, pipes, directives
- **Generic analyzer**: Fallback for non-Angular files (32 file extensions supported)
- **Local embeddings**: Transformers.js + BGE model, no API keys required
- **LanceDB vector storage**: Fast, local vector database

### Architecture

- Framework-agnostic core with pluggable analyzers
- Angular as first specialized analyzer (React/Vue extensible)
- tsconfig paths extraction for internal vs external import detection
