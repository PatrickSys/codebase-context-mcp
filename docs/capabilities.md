# Capabilities Reference

Technical reference for what `codebase-context` ships today. For the user-facing overview, see [README.md](../README.md).

## Tool Surface

10 MCP tools + 1 optional resource (`codebase://context`).

### Core Tools

| Tool | Input | Output |
| --- | --- | --- |
| `search_codebase` | `query`, optional `intent`, `limit`, `filters` | Ranked results with enrichment. Preflight card when `intent` is `edit`/`refactor`/`migrate`. |
| `get_team_patterns` | optional `category` | Pattern frequencies, trends, golden files, conflicts |
| `get_component_usage` | `name` (import source) | Files importing the given package/module |
| `remember` | `type`, `category`, `memory`, `reason` | Persists to `.codebase-context/memory.json` |
| `get_memory` | optional `category`, `type`, `query`, `limit` | Memories with confidence decay scoring |

### Utility Tools

| Tool | Purpose |
| --- | --- |
| `get_codebase_metadata` | Framework, dependencies, project stats |
| `get_style_guide` | Style rules from project documentation |
| `detect_circular_dependencies` | Import cycles in the file graph |
| `refresh_index` | Full or incremental re-index + git memory extraction |
| `get_indexing_status` | Index state, progress, last stats |

## Retrieval Pipeline

Ordered by execution:

1. **Intent classification** — EXACT_NAME (for symbols), CONCEPTUAL, FLOW, CONFIG, WIRING. Sets keyword/semantic weight ratio.
2. **Query expansion** — bounded domain term expansion for conceptual queries.
3. **Dual retrieval** — keyword (Fuse.js) + semantic (local embeddings or OpenAI).
4. **RRF fusion** — Reciprocal Rank Fusion (k=60) across all retrieval channels.
5. **Structure-aware boosting** — import centrality, composition root boost, path overlap, definition demotion for action queries.
6. **Contamination control** — test file filtering for non-test queries.
7. **File deduplication** — best chunk per file.
8. **Stage-2 reranking** — cross-encoder (`Xenova/ms-marco-MiniLM-L-6-v2`) triggers when the score between the top files are very close. CPU-only, top-10 bounded.
9. **Result enrichment** — pattern momentum (`trend`/`patternWarning`), relationships (`importedBy`/`imports`/`testedIn`/`lastModified`), related memories, search quality assessment.

## Preflight Card (Edit Intent)

Returned when search `intent` is `edit`, `refactor`, or `migrate`:

- `riskLevel`: low / medium / high (based on circular deps + impact breadth + failure memories)
- `confidence`: fresh / aging / stale (based on index age)
- `evidenceLock`: triangulated score (0-100) from code + patterns + memories, with `readyToEdit` boolean
- `epistemicStress`: triggers (pattern conflicts, stale memories, thin evidence), abstain signal
- `preferredPatterns` / `avoidPatterns`: from team pattern analysis with adoption % and trend
- `goldenFiles`: top exemplar files by modern pattern density
- `impactCandidates`: files importing the result files (from import graph)
- `failureWarnings`: recent failure memories related to the query
- `patternConflicts`: when two patterns in the same category are both > 20% adoption

## Memory System

- 4 types: `convention`, `decision`, `gotcha`, `failure`
- Confidence decay: conventions never decay, decisions 180-day half-life, gotchas/failures 90-day half-life
- Stale threshold: memories below 30% confidence are flagged
- Git auto-extraction: conventional commits from last 90 days
- Surface locations: `search_codebase` results, `get_team_patterns` responses, preflight cards

## Indexing

- Initial: full scan → chunking → embedding → vector DB (LanceDB) + keyword index (Fuse.js)
- Incremental: SHA-256 manifest diffing, selective embed/delete, full intelligence regeneration
- Auto-heal: corrupted index triggers automatic full re-index on next search
- Storage: `.codebase-context/` directory (memory.json + generated files)

## Analyzers

- **Angular**: signals, standalone components, control flow syntax, lifecycle hooks, DI patterns, component metadata
- **Generic**: 30+ languages — TypeScript, JavaScript, Python, Java, Kotlin, C/C++, C#, Go, Rust, PHP, Ruby, Swift, Scala, Shell, config/markup formats
