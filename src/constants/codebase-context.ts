// Centralized constants for on-disk MCP artifacts.
// Keep this module dependency-free to avoid import cycles.

export const CODEBASE_CONTEXT_DIRNAME = '.codebase-context' as const;

/**
 * Index format version for on-disk artifacts under `.codebase-context/`.
 *
 * Bump when:
 * - Chunk boundaries change (AST chunking rules, split/merge behavior)
 * - Embedding input string changes (e.g. scope-prefix content, prepended metadata)
 * - Required persisted fields/artifact headers change
 */
export const INDEX_FORMAT_VERSION = 1 as const;

/** Schema version for `.codebase-context/index-meta.json` itself. */
export const INDEX_META_VERSION = 1 as const;

export const INDEX_META_FILENAME = 'index-meta.json' as const;

export const MEMORY_FILENAME = 'memory.json' as const;
export const INTELLIGENCE_FILENAME = 'intelligence.json' as const;
export const KEYWORD_INDEX_FILENAME = 'index.json' as const;
export const INDEXING_STATS_FILENAME = 'indexing-stats.json' as const;
export const VECTOR_DB_DIRNAME = 'index' as const;
export const MANIFEST_FILENAME = 'manifest.json' as const;
