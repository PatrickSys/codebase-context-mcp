# Capabilities Reference

Technical reference for what `codebase-context` ships today. For the user-facing overview, see [README.md](../README.md).

## Tool Surface

10 MCP tools + 1 optional resource (`codebase://context`).

### Core Tools

| Tool | Input | Output |
| --- | --- | --- |
| `search_codebase` | `query`, optional `intent`, `limit`, `filters`, `includeSnippets` | Ranked results (`file`, `summary`, `score`, `type`, `trend`, `patternWarning`) + `searchQuality` (with `hint` when low confidence) + `preflight` ({ready, reason}). Snippets opt-in. |
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
9. **Result enrichment** — compact type (`componentType:layer`), pattern momentum (`trend` Rising/Declining only, Stable omitted), `patternWarning`, condensed relationships (`importedByCount`/`hasTests`), related memories (capped to 3), search quality assessment with `hint` when low confidence.

### Defaults

- **Chunk size**: 50 lines, 0 overlap
- **Reranker trigger**: activates when top-3 results are within 0.08 score of each other
- **Embedding model**: Granite (`ibm-granite/granite-embedding-30m-english`, 8192 token context) via `@huggingface/transformers` v3
- **Vector DB**: LanceDB with cosine distance

## Preflight (Edit Intent)

Returned as `preflight` when search `intent` is `edit`, `refactor`, or `migrate`. Also returned for default searches when intelligence is available.

Output: `{ ready: boolean, reason?: string }`

- `ready`: whether evidence is sufficient to proceed with edits
- `reason`: when `ready` is false, explains why (e.g., "Search quality is low", "Insufficient pattern evidence")

### How `ready` is determined

1. **Evidence triangulation** — scores code match (45%), pattern alignment (30%), and memory support (25%). Needs combined score ≥ 40 to pass.
2. **Epistemic stress check** — if pattern conflicts, stale memories, or thin evidence are detected, `ready` is set to false with an abstain signal.
3. **Search quality gate** — if `searchQuality.status` is `low_confidence`, `ready` is forced to false regardless of evidence scores. This prevents the "confidently wrong" problem where evidence counts look good but retrieval quality is poor.

### Internal analysis (not in output, used to compute `ready`)

- Risk level from circular deps + impact breadth + failure memories
- Preferred/avoid patterns from team pattern analysis
- Golden files by pattern density
- Impact candidates from import graph
- Failure warnings from related memories
- Pattern conflicts when two patterns in the same category are both > 20% adoption

## Memory System

- 4 types: `convention`, `decision`, `gotcha`, `failure`
- Confidence decay: conventions never decay, decisions 180-day half-life, gotchas/failures 90-day half-life
- Stale threshold: memories below 30% confidence are flagged
- Git auto-extraction: conventional commits from last 90 days
- Surface locations: `search_codebase` results (as `relatedMemories`), `get_team_patterns` responses, preflight analysis

## Indexing

- Initial: full scan → chunking (50 lines, 0 overlap) → embedding → vector DB (LanceDB) + keyword index (Fuse.js)
- Incremental: SHA-256 manifest diffing, selective embed/delete, full intelligence regeneration
- Auto-heal: corrupted index triggers automatic full re-index on next search
- Storage: `.codebase-context/` directory (memory.json + generated files)

## Analyzers

- **Angular**: signals, standalone components, control flow syntax, lifecycle hooks, DI patterns, component metadata
- **Generic**: 30+ languages — TypeScript, JavaScript, Python, Java, Kotlin, C/C++, C#, Go, Rust, PHP, Ruby, Swift, Scala, Shell, config/markup formats
