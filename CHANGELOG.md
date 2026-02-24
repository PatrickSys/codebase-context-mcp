# Changelog

## [1.7.1] - 2026-02-23

CLI polish release. The `patterns`, `search`, and `refs` commands now render structured ASCII box art instead of raw JSON dumps. Also fixes a bug where `@Injectable({ providedIn: 'root' })` was silently lost during indexing.

### Changed

- **CLI output**: `patterns`, `search`, and `refs` now render ASCII box art by default. Pass `--json` for raw JSON (unchanged). `search` wraps the preflight decision card in a titled box showing quality, ready status, patterns, and best example. `patterns` renders sections (categories, golden files, conflicts, memories) inside a single `Team Patterns` box. `refs` renders a tree graph with `├─`/`└─`/`│` showing each reference location and a preview snippet.
- **Human-readable labels**: `interceptor:core` → `interceptor (core)` in search results. Trend labels are lowercase plain text (`rising`/`declining`) instead of `↑ Rising`/`↓ Declining`.
- **`Standalone` → `Standalone component`** pattern name — more descriptive in pattern output and decision cards.
- **`providedIn` summary**: Angular service summaries now show `Angular service 'AuthStore' (root)` when present, and drop the `(providedIn: unknown)` noise when absent.

### Fixed

- **`providedIn` pipeline bug**: `@Injectable({ providedIn: 'root' })` was extracted correctly by the AST parser but dropped during chunking because `component.metadata` (per-component fields: `providedIn`, `selector`, `isStandalone`) was never spread into the chunk. File-level metadata (`framework`, `layer`) was spread but per-component metadata was not. Fixed by spreading `...component.metadata` before `...metadata` so decorator fields survive the pipeline.
- **Redundant `standalone` tag** removed from chunk tags — it duplicated the `isStandalone` metadata field with no benefit.

### Added

- **Response type interfaces** (`SearchResponse`, `PatternResponse`, `RefsResponse`, etc.) in `src/tools/types.ts`, replacing all `Record<string, unknown>` casts in the CLI formatters.

## [1.7.0](https://github.com/PatrickSys/codebase-context/compare/v1.6.1...v1.7.0) (2026-02-21)

The Tree-sitter release. Code structure is now parsed, not guessed. Search results know where symbols are defined, who calls them, and whether there's enough evidence to edit safely.

### Added

- **Tree-sitter AST chunking** for 10 languages: TypeScript, JavaScript, Python, Java, Kotlin, C, C++, C#, Go, Rust. Code is split along symbol boundaries instead of arbitrary line counts. Each chunk gets a scope-aware prefix (e.g. `// AuthService.getToken()`) so agents know where code lives without reading the whole file. Languages without a Tree-sitter grammar fall back to safe line-based chunking.
- **Definition-first ranking**: Exact-name searches show the file that *defines* a symbol before files that merely use it. Searching `parseConfig` shows the function definition first, then callers.
- **Edit decision card**: Search with `intent="edit"` now returns a decision card — `ready` (boolean), `nextAction` (what to do if not ready), `patterns` (do/avoid with adoption %), `bestExample`, `impact` (caller coverage), and `whatWouldHelp` (specific searches to close evidence gaps). Built on AST-derived caller data, not heuristics.
- **`get_symbol_references` tool**: Concrete symbol usage evidence — usageCount, top snippets, callers/consumers. Includes `confidence: "syntactic"` so agents know it's static analysis, not runtime tracing.
- **Relationship sidecar** (`relationships.json`): File import graph, reverse imports, and symbol export index. Search results now include a `hints` object with ranked callers, consumers, and test files drawn from this graph.
- **Index versioning + crash-safe rebuilds**: Index artifacts carry version metadata. Mismatches trigger automatic full rebuild. Rebuilds write to `.staging/` and swap atomically — a failed rebuild never corrupts the active index.
- **All 10 MCP tools as CLI commands**: `npx codebase-context search`, `patterns`, `refs`, `cycles`, `memory`, etc. No AI agent required. Useful for scripting, debugging, and CI.
- **Multi-codebase eval runner**: `npm run eval -- <codebaseA> <codebaseB>` with per-codebase reports. Ships with a frozen controlled fixture for fully-offline runs.
- **Expanded language coverage**: Added `.pyi`, `.php`, `.kt`/`.kts`, `.cc`/`.cxx`, `.cs`, `.swift`, `.scala`, `.toml`, `.xml` to indexing.

### Changed

- **Preflight response**: `reason` renamed to `nextAction`. Internal fields (`evidenceLock`, `riskLevel`, `confidence`) removed — the output shape is now stable.
- **`get_component_usage` removed** from MCP surface (11 → 10 tools). Use `get_symbol_references` instead for symbol usage evidence.
- **Strict typing**: Eliminated all 68 `any` types across 15 files. `@typescript-eslint/no-explicit-any` promoted from `warn` to `error`. Consolidated duplicate type definitions into single sources of truth.

### Fixed

- Null-pointer crash in GenericAnalyzer when chunk content is undefined.
- Tree-sitter symbol extraction now handles UTF-8 byte offsets correctly and evicts cached parsers on failures/timeouts.
- Post-merge integration gaps: removed orphaned source files and dead guidance strings from the deleted `get_component_usage` tool. Decision card now returns `ready: false` with actionable guidance when `intelligence.json` is absent, instead of silently skipping.

## [1.6.2] - 2026-02-17

Stripped it down for token efficiency, moved CLI code out of the protocol layer, and cleared structural debt.

### Changed

- **Search output**: `trend: "Stable"` is no longer emitted (only Rising/Declining carry signal). Added a compact `type` field (`service:data`) merging componentType and layer into 2 tokens. Removed `lastModified` considered noise.
- **searchQuality**: now includes `hint` (for next-step suggestion) when status is `low_confidence`, so agents get actionable guidance without a second tool call.
- **Tool description**: shortened to 2 actionable sentences, removed reference to `editPreflight` (which didn't exist in output). `intent` parameter is now discoverable on first scan.
- **CLI extraction**: `handleMemoryCli` moved from `src/index.ts` to `src/cli.ts`. Protocol file is routing only.
- **Angular self-registration**: `registerComplementaryPatterns('reactivity', ...)` moved from `src/index.ts` into `AngularAnalyzer` constructor. Framework patterns belong in their analyzer.

### Added

- `AGENTS.md` Lessons Learned section - captures behavioral findings from the 0216 eval: AI fluff loop, self-eval bias, static data as noise, agents don't read past first line.
- Release Checklist in `AGENTS.md`: CHANGELOG + README + capabilities.md + tests before any version bump.

## [1.6.1](https://github.com/PatrickSys/codebase-context/compare/v1.6.0...v1.6.1) (2026-02-15)

Fixed the quality assessment on the search tool bug, stripped search output from 15 fields to 6 reducing token usage by 50%, added CLI memory access, removed Angular patterns from core.

### Bug Fixes

- **Confident Idiot fix**: evidence lock now checks search quality - if retrieval is `low_confidence`, `readyToEdit` is forced `false` regardless of evidence counts.
- **Search output overhaul**: stripped from ~15 fields per result down to 6 (`file`, `summary`, `score`, `trend`, `patternWarning`, `relationships`). Snippets opt-in only.
- **Preflight flattened**: from nested `evidenceLock`/`epistemicStress` to `{ ready, reason }`.
- **Angular framework leakage**: removed hardcoded Angular patterns from `src/core/indexer.ts` and `src/patterns/semantics.ts`. Core is framework-agnostic again.
- **Angular analyzer**: fixed `providedIn: unknown` bug — metadata extraction path was wrong.
- **CLI memory access**: `codebase-context memory list|add|remove` works without any AI agent.
- guard null chunk.content crash ([6b89778](https://github.com/PatrickSys/codebase-context/commit/6b8977897665ea3207e1bbb0f5d685c61d41bbb8))

## [1.6.0](https://github.com/PatrickSys/codebase-context/compare/v1.5.1...v1.6.0) (2026-02-11)

### Features

- v1.6.0 search quality improvements ([#26](https://github.com/PatrickSys/codebase-context/issues/26)) ([8207787](https://github.com/PatrickSys/codebase-context/commit/8207787db45c9ee3940e22cb3fd8bc88a2c6a63b))

## [1.6.0](https://github.com/PatrickSys/codebase-context/compare/v1.5.1...v1.6.0) (2026-02-10)

### Added

- **Search Quality Improvements** — Weighted hybrid search with intent-aware classification
  - Intent-aware query classification (EXACT_NAME, CONCEPTUAL, FLOW, CONFIG, WIRING)
  - Reciprocal Rank Fusion (RRF, k=60) for robust rank-based score combination
  - Hard test-file filtering (eliminates spec contamination in non-test queries)
  - Import-graph proximity reranking (structural centrality boosting)
  - File-level deduplication (one best chunk per file)
- **Evaluation Harness** — Frozen fixture set with reproducible methodology
- **Embedding Upgrade** — Granite model support (47M params, 8192 context)
- **Chunk Optimization** — 100→50 lines, overlap 10→0, merge small chunks

### Changed

- **Dependencies**: `@xenova/transformers` v2 → `@huggingface/transformers` v3
- **Indexing**: Tighter chunks (50 lines) with zero overlap
- **Search**: RRF fusion immune to score distribution differences

### Fixed

- Intent-blind search (conceptual queries now classified and routed correctly)
- Spec file contamination (test files hard-filtered from non-test query results)
- Embedding truncation (granite's 8192 context eliminates previous 512 token limit)

### Note

**Re-indexing recommended** for best results due to chunking changes.
Existing indices remain readable — search still works without re-indexing.
To re-index: `refresh_index(incrementalOnly: false)` or delete `.codebase-context/` folder.

## [1.5.1](https://github.com/PatrickSys/codebase-context/compare/v1.5.0...v1.5.1) (2026-02-08)

### Bug Fixes

- use cosine distance for vector search scoring ([b41edb7](https://github.com/PatrickSys/codebase-context/commit/b41edb7e4c1969b04d834ec52a9ae43760e796a9))

## [1.5.0](https://github.com/PatrickSys/codebase-context/compare/v1.4.1...v1.5.0) (2026-02-08)

### Added

- **Preflight evidence lock**: `search_codebase` edit/refactor/migrate intents now return risk-aware preflight guidance with evidence lock scoring, impact candidates, preferred/avoid patterns, and related memories. ([#21](https://github.com/PatrickSys/codebase-context/issues/21))
- **Trust-aware memory handling**: Git-aware memory pattern support and confidence decay so stale or malformed evidence is surfaced as lower-confidence context instead of trusted guidance. ([#21](https://github.com/PatrickSys/codebase-context/issues/21))

### Changed

- **Search ranking**: Removed framework-specific anchor/query promotion heuristics from core ranking flow to keep retrieval behavior generic across codebases. ([#22](https://github.com/PatrickSys/codebase-context/issues/22))
- **Search transparency**: `search_codebase` now returns `searchQuality` with confidence and diagnostic signals when retrieval looks ambiguous. ([#22](https://github.com/PatrickSys/codebase-context/issues/22))
- **Incremental indexing state**: Persist indexing counters to `indexing-stats.json` and restore them on no-op incremental runs to keep status reporting accurate on large codebases. ([#22](https://github.com/PatrickSys/codebase-context/issues/22))
- **Docs**: Updated README performance section to reflect shipped incremental refresh mode (`incrementalOnly`).

### Fixed

- **No-op incremental stats drift**: Fixed under-reported `indexedFiles` and `totalChunks` after no-change incremental refreshes by preferring persisted stats over capped index snapshots. ([#22](https://github.com/PatrickSys/codebase-context/issues/22))
- **Memory date validation**: Invalid memory timestamps now degrade to stale evidence rather than being surfaced as semi-trusted data. ([#21](https://github.com/PatrickSys/codebase-context/issues/21))

## [1.4.1](https://github.com/PatrickSys/codebase-context/compare/v1.4.0...v1.4.1) (2026-01-29)

### Bug Fixes

- **lint:** disable no-explicit-any rule for AST manipulation code ([41547da](https://github.com/PatrickSys/codebase-context/commit/41547da2aa5529dce3d539c296d5e9d79df379fe))

## [1.4.0] - 2026-01-28

### Added

- **Memory System**: New `remember` and `get_memory` tools capture team conventions, decisions, and gotchas
  - **Types**: `convention` | `decision` | `gotcha`
  - **Categories**: `tooling`, `architecture`, `testing`, `dependencies`, `conventions`
  - **Storage**: `.codebase-context/memory.json` with content-based hash IDs (commit this)
  - **Safety**: `get_memory` truncates unfiltered results to 20 most recent
- **Integration with `get_team_patterns`**: Appends relevant memories when category overlaps
- **Integration with `search_codebase`**: Surfaces `relatedMemories` via keyword match in search results

### Changed

- **File Structure**: All MCP files now organized in `.codebase-context/` folder for cleaner project root
  - Vector DB: `.codebase-index/` → `.codebase-context/index/`
  - Intelligence: `.codebase-intelligence.json` → `.codebase-context/intelligence.json`
  - Keyword index: `.codebase-index.json` → `.codebase-context/index.json`
  - **Migration**: Automatic on server startup (legacy JSON preserved; vector DB directory moved)

### Fixed

- **Startup safety**: Validates `ROOT_PATH` before running migration to avoid creating directories on typo paths

### Why This Feature

Patterns show "what" (97% use inject) but not "why" (standalone compatibility). AGENTS.md can't capture every hard-won lesson. Decision memory gives AI agents access to the team's battle-tested rationale.

**Design principle**: Tool must be self-evident without AGENTS.md rules. "Is this about HOW (record) vs WHAT (don't record)"

**Inspired by**: v1.1 Pattern Momentum (temporal dimension) + memory systems research (Copilot Memory, Gemini Memory)

## [1.3.3] - 2026-01-18

### Fixed

- **Security**: Resolve `pnpm audit` advisories by updating `hono` to 4.11.4 and removing the vulnerable `diff` transitive dependency (replaced `ts-node` with `tsx` for `pnpm dev`).

### Changed

- **Docs**: Clarify private `internal-docs/` submodule setup, add `npx --yes` tip, document `CODEBASE_ROOT`, and list `get_indexing_status` tool.
- **Submodule**: Disable automatic updates for `internal-docs` (`update = none`).

### Removed

- **Dev**: Remove local-only `test-context.cjs` helper script.

## [1.3.2] - 2026-01-16

### Changed

- **Embeddings**: Batch embedding now uses a single Transformers.js pipeline call per batch for higher throughput.
- **Dependencies**: Bump `@modelcontextprotocol/sdk` to 1.25.2.

## [1.3.1] - 2026-01-05

### Fixed

- **Auto-Heal Semantic Search**: Detects LanceDB schema corruption (missing `vector` column), triggers re-indexing, and retries search instead of silently falling back to keyword-only results.

## [1.3.0] - 2026-01-01

### Added

- **Workspace Detection**: Monorepo support for Nx, Turborepo, Lerna, and pnpm workspaces
  - New utility: `src/utils/workspace-detection.ts`
  - Functions: `scanWorkspacePackageJsons()`, `detectWorkspaceType()`, `aggregateWorkspaceDependencies()`
- **Testing Infrastructure**: Vitest smoke tests for core utilities
  - Tests for workspace detection, analyzer registry, and indexer metadata
  - CI/CD workflow via GitHub Actions
- **Dependency Detection**: Added `@nx/` and `@nrwl/` prefix matching for build tools

### Fixed

- **detectMetadata() bug**: All registered analyzers now contribute to codebase metadata (previously only the first analyzer was called)
  - Added `mergeMetadata()` helper with proper array deduplication and layer merging

### Changed

- Updated roadmap: v1.3 is now "Extensible Architecture Foundation"

### Acknowledgements

Thanks to [@aolin480](https://github.com/aolin480) for accelerating the workspace detection roadmap and identifying the detectMetadata() limitation in their fork.

## 1.2.2 (2025-12-31)

### Fixed

- **Critical Startup Crash**: Fixed immediate "Exit Code 1" silent crash on Windows by handling unhandled rejections during startup
- **MCPJam Compatibility**: Removed `logging` capability (which was unimplemented) to support strict MCP clients like MCPJam
- **Silent Failure**: Added global exception handlers to stderr to prevent silent failures in the future

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
