# Changelog

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
