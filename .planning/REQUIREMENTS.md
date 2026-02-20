# Requirements: codebase-context (Milestone v1.7.0 AST-Aligned Search)

**Defined:** 2026-02-20
**Core Value:** Agents understand code as symbols with relationships, not text with line numbers.

## v1 Requirements

### Tree-sitter UAT Gap Closures (Shipped)

- [x] **TS-UAT-02-parse-error-fallback**: When Tree-sitter parse trees contain errors, indexing falls back to reliable extraction (no corrupt symbol chunks).
- [x] **TS-UAT-02-preserve-symbol-chunks**: Indexing preserves one symbol-aware chunk per symbol and does not merge symbol-aware chunks.
- [x] **TS-UAT-02-get-symbol-references**: MCP exposes `get_symbol_references` with `usageCount` and top-N concrete usages.

### Grammar Assets

- [ ] **GRAM-01**: Tool ships a curated set of Tree-sitter grammar `.wasm` assets locally (no runtime downloads) and lazy-loads them by detected language.
- [ ] **GRAM-02**: CI verifies every shipped grammar loads + parses at least one real fixture and fails closed to fallback on ABI mismatch.

### AST-Aligned Chunking

- [ ] **AST-01**: For supported languages, indexing splits files into symbol-bounded chunks (functions/classes/methods) and `search_codebase` returns those complete symbols (not mid-block slices).
- [ ] **AST-02**: Chunk text includes a scope-aware prefix (symbol path + signature context) to improve retrieval without changing the `search_codebase` response shape.
- [ ] **AST-03**: Chunking enforces minimum/maximum bounds (merge tiny symbols, split oversized symbols at safe boundaries like methods) to avoid low-signal or too-large embeddings.
- [ ] **AST-04**: Chunking degrades safely: file size/line ceilings + parse timeout + parse-error detection, with deterministic fallback to line chunks.

### Search Output: High Signal / Low Noise

- [ ] **SEARCH-01**: `search_codebase` ranks and de-duplicates at the symbol level (definition-first for EXACT_NAME intent, diverse results for conceptual queries) and suppresses obvious noise (tests/vendor/generated).
- [ ] **SEARCH-02**: `includeSnippets=true` returns an opt-in “smart snippet” that is exactly the symbol range plus minimal structural context (never unrelated siblings).
- [ ] **SEARCH-03**: Results include lightweight relationship hints (callers/consumers/tests) when available, capped and ranked for edit actionability.

### Symbol References + Relationship Store

- [ ] **REFS-01**: Indexing persists a versioned relationship sidecar (e.g., `symbol-graph.json`) used for exact symbol lookups, reference lists, and impact summaries (not stored in LanceDB).
- [ ] **REFS-02**: `get_symbol_references` returns a conservative, concrete list of syntactic usages with `usageCount`, top-N locations, and a completeness/confidence indicator.
- [ ] **REFS-03**: `get_component_usage` is deprecated/removed from the MCP surface; its primary use case is covered by `get_symbol_references`.
- [ ] **REFS-04**: Incremental indexing updates the relationship sidecar: changed/added/deleted files update definitions/refs/edges, and importer files of changed modules are re-resolved to avoid stale edges.

### Decision-Card Preflight (Impact-Aware)

- [ ] **PREF-01**: For `intent="edit"|"refactor"|"migrate"`, `search_codebase` returns a decision card with `ready` plus an actionable `nextAction` when not ready.
- [ ] **PREF-02**: Preflight gating uses impact coverage: when dependents/callers exist, readiness requires evidence to cover them (fails closed when coverage is low or ambiguous).
- [ ] **PREF-03**: Decision card includes (when evidence supports it): do/don't patterns, one “best example”, and capped impact summary; sections are suppressed when evidence is thin.
- [ ] **PREF-04**: Decision card is optimized for AI agents: stable field names, strict caps per section, explicit evidence citations (file:line ranges), and a “what would make this ready” probe list when blocked.

### Index Versioning + Migration

- [ ] **MIGR-01**: Index format is versioned (chunks + relationship store); mixed-version indexes are never served.
- [ ] **MIGR-02**: On version mismatch/corruption, the system triggers an all-or-nothing full re-index transparently (no user action), and reports confidence/staleness in tool output.

### Evaluation & Guardrails

- [x] **EVAL-01**: Frozen eval fixture (>=20 queries, >=2 codebases) is committed before implementation; angular-spotify is the primary real-world target; reports both wins and failures honestly.
- [x] **EVAL-02**: Regression tests cover Unicode boundaries, large/generated files, parse timeouts/reset, and Tree-sitter resource cleanup.

### Public Docs (Evidence-Backed)

- [ ] **DOCS-01**: Public-facing docs are updated with shipped capabilities and known limitations (README, CHANGELOG, MOTIVATION.md, `docs/`), with no overclaiming.

## v2 Requirements

Deferred to future release.

- **IMPACT-01**: Multi-hop impact summaries (callers-of-callers) with conservative confidence, capped depth, and clear “may be incomplete” labeling.
- **LANG-01**: Expand grammar set beyond the initial curated list without increasing default install footprint.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Standalone `get_call_graph` tool | Agents need verdicts + next probes; raw graphs are token-expensive and easy to misinterpret. |
| Standalone `get_impact_radius` tool | Impact should surface through preflight guidance rather than a separate graph-shaped payload. |
| Full LSP / type-checker integration | Violates stack simplicity and multi-language neutrality; Tree-sitter is syntactic. |
| Runtime grammar downloads | Adds network dependency; breaks offline/private-first expectations. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TS-UAT-02-parse-error-fallback | Phase 02 | Complete |
| TS-UAT-02-preserve-symbol-chunks | Phase 02 | Complete |
| TS-UAT-02-get-symbol-references | Phase 02 | Complete |
| GRAM-01 | Phase 04 | Pending |
| GRAM-02 | Phase 04 | Pending |
| AST-01 | Phase 05 | Pending |
| AST-02 | Phase 05 | Pending |
| AST-03 | Phase 05 | Pending |
| AST-04 | Phase 05 | Pending |
| SEARCH-01 | Phase 09 | Pending |
| SEARCH-02 | Phase 09 | Pending |
| SEARCH-03 | Phase 08 | Pending |
| REFS-01 | Phase 07 | Pending |
| REFS-02 | Phase 08 | Pending |
| REFS-03 | Phase 08 | Pending |
| REFS-04 | Phase 07 | Pending |
| PREF-01 | Phase 09 | Pending |
| PREF-02 | Phase 09 | Pending |
| PREF-03 | Phase 09 | Pending |
| PREF-04 | Phase 09 | Pending |
| MIGR-01 | Phase 06 | Pending |
| MIGR-02 | Phase 06 | Pending |
| EVAL-01 | Phase 03 | Complete |
| EVAL-02 | Phase 03 | Complete |
| DOCS-01 | Phase 09 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after starting milestone v1.7.0 AST-Aligned Search*
