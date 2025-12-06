# Changelog

## 1.2.0 (2025-12-06)

### Added

- **File watcher**: Automatic re-indexing when source files change
  - Auto-enabled by default (disable with `WATCH_FILES=false`)
  - 2-second debounce to avoid excessive re-indexing
  - Ignores node_modules, dist, .git, and test files by default

- **Import graph & wrapper detection**: Track library usage for AI-inferred wrappers
  - `get_component_usage` returns usage counts per library
  - `topUsed` array shows usage ratios (e.g., `@mycompany/ui: 847` vs `primeng: 3`)
  - Exposes tsconfig paths so AI can identify internal vs external imports

- **Enhanced `get_indexing_status`**: Now includes file watcher stats and pending changes
  - Shows `pendingChanges` count (files changed since last index)
  - Provides actionable hints for re-indexing decisions

- **`incrementalOnly` option for `refresh_index`**: API ready for Phase 2 incremental indexing

### Changed

- **Framework-agnostic architecture clarified**: Works on ANY project, Angular as first specialized analyzer
  - Generic analyzer supports 32 file extensions (JS, TS, Python, Java, Go, Rust, etc.)
  - Angular patterns (inject, signals, standalone) are specialized intelligence, not a requirement

- **Angular analyzer enhancements**:
  - `detectedPatterns` array for generic forwarding to indexer
  - Better standalone detection (explicit flag OR modern patterns)
  - Added `usesRxJS`, `usesEffect`, `usesComputed` flags

- **Indexer now forwards patterns generically**: Keeps core framework-agnostic

- README updated with correct "works on any project" messaging


---

## 1.1.0 (2025-12-05)

### Added
- **Testing framework detection**: Detects Jest, Jasmine/Karma, Vitest, Cypress, Playwright from actual code patterns (not just package.json)
- **Golden Files**: Surfaces files that demonstrate all team patterns together—one file for AI to mimic
- **Wrapper recommendations**: Exposes library wrapper detection in `get_team_patterns` response
- **Test utilities tracking**: Detects ng-mocks, MSW, Testing Library usage

### Changed
- Framework-agnostic indexer: Pattern detection moved into framework analyzers, indexer just forwards
- Test files now parsed for pattern detection (`parseTests: true`)

### Removed
- `get_analyzer_info` tool: Provided no user value—pure implementation details that wasted context window

---

## 1.0.0 (2025-11-29)

Initial release.

- Semantic search using local embeddings (Transformers.js + BGE model)
- Angular analyzer: detects components, services, guards, interceptors, pipes, directives
- Architectural layer detection: presentation, business, data, core, shared
- Angular v17+ pattern detection: signals, `inject()`, `@if`/`@for` syntax
- Hybrid search: combines semantic similarity with keyword matching
- LanceDB vector storage
- Auto-indexes on startup
- No API keys required, runs 100% locally

**Known limitations:**

- Angular only (React/Vue analyzers not yet implemented)
- Full re-index on every restart (no incremental indexing yet)
