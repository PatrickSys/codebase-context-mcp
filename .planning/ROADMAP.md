# ROADMAP

This is the phase roadmap used by `gsd-tools` to enumerate goals and requirements for plan verification.

Milestone: v1.7.0 AST-Aligned Search
Depth: standard

## Phases

- [x] **Phase 02: Tree-sitter (UAT gap closures)** - Robust parsing fallback + preserve symbol chunks + `get_symbol_references`
- [x] **Phase 03: Evaluation & Guardrails** - Frozen multi-repo eval + regression fixtures before changing chunking/ranking (completed 2026-02-20)
- [ ] **Phase 04: Grammar Assets & Loader** - Vendored Tree-sitter WASM grammars with CI load/parse verification
- [ ] **Phase 05: AST-Aligned Chunking** - Symbol-bounded chunks with scope context and deterministic fallback
- [ ] **Phase 06: Index Versioning & Migration** - Version-gated indexes + transparent full reindex on mismatch/corruption
- [ ] **Phase 07: Relationship Sidecar (Incremental)** - Versioned symbol relationship store updated on incremental indexing
- [ ] **Phase 08: References + Relationship Hints** - Conservative `get_symbol_references`, remove `get_component_usage`, add relationship hints
- [ ] **Phase 09: High-Signal Search + Decision Card + Docs** - Ranking/snippets + impact-aware preflight + evidence-backed docs

## Phase Details

### Phase 02: Tree-sitter (UAT gap closures)
**Goal**: Tree-sitter indexing is safe under parse errors and agents can query symbol references.
**Depends on**: Nothing (historical phase)
**Requirements**: TS-UAT-02-parse-error-fallback, TS-UAT-02-preserve-symbol-chunks, TS-UAT-02-get-symbol-references
**Success Criteria** (what must be TRUE):
  1. When Tree-sitter produces an errorful tree, indexing falls back to a reliable mode and does not emit corrupt symbol chunks.
  2. Symbol-aware chunks remain one-per-symbol and are not merged during small-chunk merge behavior.
  3. Calling `get_symbol_references` returns `usageCount` and top-N concrete usages.
**Plans**: 3/3 plans complete

Plans:
  - [x] 02-tree-sitter/02-01-PLAN.md — Treat parse errors as unsupported + regression test
  - [x] 02-tree-sitter/02-02-PLAN.md — Prevent merging symbol-aware chunks + regression test
  - [x] 02-tree-sitter/02-03-PLAN.md — Add MCP `get_symbol_references` tool + tests

### Phase 03: Evaluation & Guardrails
**Goal**: Users can measure retrieval/preflight quality changes and regressions are caught automatically.
**Depends on**: Phase 02
**Requirements**: EVAL-01, EVAL-02
**Success Criteria** (what must be TRUE):
  1. Running `npm run eval -- <codebaseA> <codebaseB>` executes a frozen >=20-query fixture and prints an honest report (wins and failures).
  2. A regression test suite fails on Unicode slicing bugs, large/generated file handling, parse timeout/reset behavior, and Tree-sitter resource cleanup leaks.
  3. Eval fixtures are committed and can be re-run later without editing expected outcomes to match results.
**Plans**: 3 plans

Plans:
  - [x] 03-evaluation-guardrails/03-01-PLAN.md — Controlled eval codebase + frozen fixture
  - [ ] 03-evaluation-guardrails/03-02-PLAN.md — Regression guardrails (Unicode/large files/reset/cleanup)
  - [ ] 03-evaluation-guardrails/03-03-PLAN.md — Shared eval harness module + multi-codebase `npm run eval`

### Phase 04: Grammar Assets & Loader
**Goal**: Tree-sitter grammars are available offline, load reliably, and fail closed to fallback when incompatible.
**Depends on**: Phase 03
**Requirements**: GRAM-01, GRAM-02
**Success Criteria** (what must be TRUE):
  1. On a machine with no network access, indexing supported languages can load a bundled grammar and parse at least one real fixture.
  2. If a shipped grammar cannot load (ABI mismatch or corruption), indexing does not crash and deterministically falls back to line-chunking.
  3. CI fails if any shipped grammar cannot load and parse its fixture.
**Plans**: TBD

### Phase 05: AST-Aligned Chunking
**Goal**: For supported languages, search returns complete symbols (functions/classes/methods) as the primary retrieval unit.
**Depends on**: Phase 04
**Requirements**: AST-01, AST-02, AST-03, AST-04
**Success Criteria** (what must be TRUE):
  1. `search_codebase` results for supported files return whole symbol definitions (not mid-block slices) for typical EXACT_NAME queries.
  2. Returned chunk text includes a scope-aware prefix (symbol path/signature context) without changing the `search_codebase` response shape.
  3. Very small symbols are merged and very large symbols are split at safe structural boundaries so chunks stay within configured size bounds.
  4. When parsing is too slow, errorful, or the file is too large, indexing falls back to deterministic line chunks and results remain usable.
**Plans**: TBD

### Phase 06: Index Versioning & Migration
**Goal**: Users never receive mixed-version index data; old/corrupt indexes transparently rebuild to a consistent version.
**Depends on**: Phase 05
**Requirements**: MIGR-01, MIGR-02
**Success Criteria** (what must be TRUE):
  1. If an on-disk index is from an older format, the next tool call triggers an all-or-nothing full reindex without requiring user action.
  2. Mixed-version indexes are never served; tool output reflects staleness/confidence when a rebuild is needed or in progress.
  3. If index metadata is corrupt or inconsistent, the system fails closed (no partial results) and rebuilds.
**Plans**: TBD

### Phase 07: Relationship Sidecar (Incremental)
**Goal**: Indexing produces and maintains a lightweight, versioned symbol relationship sidecar usable for refs and impact summaries.
**Depends on**: Phase 06
**Requirements**: REFS-01, REFS-04
**Success Criteria** (what must be TRUE):
  1. After indexing, a relationship sidecar exists on disk and can be used for exact symbol lookup and relationship summaries.
  2. After changing/adding/deleting files and re-indexing, the sidecar updates (definitions/refs/edges) without requiring a full rebuild.
  3. When a module changes, importer files are re-resolved so edges do not remain stale.
**Plans**: TBD

### Phase 08: References + Relationship Hints
**Goal**: Agents can conservatively locate symbol usages and see capped relationship hints for edit actionability.
**Depends on**: Phase 07
**Requirements**: REFS-02, REFS-03, SEARCH-03
**Success Criteria** (what must be TRUE):
  1. `get_symbol_references` returns a conservative set of concrete syntactic usages with `usageCount`, top-N locations, and a completeness/confidence indicator.
  2. `get_component_usage` is no longer exposed on the MCP surface, and its primary use case is covered by `get_symbol_references`.
  3. `search_codebase` results can include capped, ranked relationship hints (callers/consumers/tests) when evidence exists.
**Plans**: TBD

### Phase 09: High-Signal Search + Decision Card + Docs
**Goal**: Search results and preflight are optimized for safe agent edits: definition-first, low-noise, cited, and fail-closed when evidence is thin.
**Depends on**: Phase 08
**Requirements**: SEARCH-01, SEARCH-02, PREF-01, PREF-02, PREF-03, PREF-04, DOCS-01
**Success Criteria** (what must be TRUE):
  1. `search_codebase` ranks and de-duplicates at the symbol level (definition-first for EXACT_NAME; diverse for conceptual) and suppresses obvious noise.
  2. With `includeSnippets=true`, results include a smart snippet that is exactly the symbol range plus minimal structural context (no unrelated siblings).
  3. For `intent="edit"|"refactor"|"migrate"`, `search_codebase` includes a decision card with `ready` and an actionable `nextAction` when not ready.
  4. When callers/dependents exist, preflight readiness requires evidence coverage for them and fails closed when coverage is low/ambiguous.
  5. Public docs describe shipped capabilities and known limitations without overclaiming.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 02. Tree-sitter (UAT gap closures) | 3/3 | Complete | 2026-02-20 |
| 03. Evaluation & Guardrails | 3/3 | Complete   | 2026-02-20 |
| 04. Grammar Assets & Loader | 0/0 | Not started | - |
| 05. AST-Aligned Chunking | 0/0 | Not started | - |
| 06. Index Versioning & Migration | 0/0 | Not started | - |
| 07. Relationship Sidecar (Incremental) | 0/0 | Not started | - |
| 08. References + Relationship Hints | 0/0 | Not started | - |
| 09. High-Signal Search + Decision Card + Docs | 0/0 | Not started | - |
