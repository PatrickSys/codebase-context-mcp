# Changelog

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
