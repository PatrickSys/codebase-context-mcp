/**
 * Library entry point for codebase-context-mcp
 *
 * This module exports the public API for programmatic use.
 * For the MCP server, import from 'codebase-context-mcp/server' or run the CLI.
 *
 * @example
 * ```typescript
 * import {
 *   CodebaseIndexer,
 *   CodebaseSearcher,
 *   analyzerRegistry,
 *   AngularAnalyzer,
 *   GenericAnalyzer
 * } from 'codebase-context-mcp';
 *
 * // Register analyzers
 * analyzerRegistry.register(new AngularAnalyzer());
 * analyzerRegistry.register(new GenericAnalyzer());
 *
 * // Create and run indexer
 * const indexer = new CodebaseIndexer({
 *   rootPath: '/path/to/project',
 *   onProgress: (progress) => console.log(progress)
 * });
 * const stats = await indexer.index();
 *
 * // Search the indexed codebase
 * const searcher = new CodebaseSearcher('/path/to/project');
 * const results = await searcher.search('how do we handle errors?');
 * ```
 */

// Core classes
export { CodebaseIndexer, type IndexerOptions } from "./core/indexer.js";
export { CodebaseSearcher, type SearchOptions } from "./core/search.js";
export {
  AnalyzerRegistry,
  analyzerRegistry,
} from "./core/analyzer-registry.js";

// Embedding providers
export {
  getEmbeddingProvider,
  TransformersEmbeddingProvider,
  type EmbeddingProvider,
  type EmbeddingConfig,
  DEFAULT_EMBEDDING_CONFIG,
} from "./embeddings/index.js";

// Storage providers
export {
  getStorageProvider,
  LanceDBStorageProvider,
  type VectorStorageProvider,
  type StorageConfig,
  type CodeChunkWithEmbedding,
  DEFAULT_STORAGE_CONFIG,
} from "./storage/index.js";

// Framework analyzers
export { AngularAnalyzer } from "./analyzers/angular/index.js";
export { GenericAnalyzer } from "./analyzers/generic/index.js";

// Utilities
export {
  isCodeFile,
  isBinaryFile,
  detectLanguage,
  isTestFile,
  isDocumentationFile,
  getSupportedExtensions,
} from "./utils/language-detection.js";
export {
  createChunksFromCode,
  calculateComplexity,
  mergeSmallChunks,
  type ChunkingOptions,
} from "./utils/chunking.js";

// All types
export type {
  // Analyzer interface
  FrameworkAnalyzer,

  // Analysis results
  AnalysisResult,
  CodeComponent,
  ImportStatement,
  ExportStatement,
  Dependency,
  DependencyCategory,
  ArchitecturalLayer,

  // Code chunks
  CodeChunk,
  ChunkMetadata,

  // Codebase metadata
  CodebaseMetadata,
  FrameworkInfo,
  LanguageInfo,
  ArchitectureInfo,
  ModuleInfo,
  ProjectStructure,
  PackageInfo,
  CodebaseStatistics,

  // Style guides and documentation
  StyleGuide,
  StyleRule,
  CodeExample,
  DocumentationFile,
  DocumentationSection,

  // Search
  SearchQuery,
  SearchFilters,
  SearchResult,
  TextHighlight,

  // Indexing
  IndexingProgress,
  IndexingPhase,
  IndexingError,
  IndexingStats,

  // Configuration
  AnalyzerConfig,
  CodebaseConfig,

  // Utilities
  Decorator,
  Property,
  Method,
  Parameter,
} from "./types/index.js";

/**
 * Convenience function to create a fully configured indexer with default analyzers
 *
 * @param rootPath - Path to the project root
 * @param options - Optional indexer configuration
 * @returns A configured CodebaseIndexer instance
 */
export function createIndexer(
  rootPath: string,
  options?: Partial<
    Omit<import("./core/indexer.js").IndexerOptions, "rootPath">
  >
): import("./core/indexer.js").CodebaseIndexer {
  const { CodebaseIndexer } = require("./core/indexer.js");
  const { AngularAnalyzer } = require("./analyzers/angular/index.js");
  const { GenericAnalyzer } = require("./analyzers/generic/index.js");
  const { analyzerRegistry } = require("./core/analyzer-registry.js");

  // Register default analyzers if not already registered
  if (!analyzerRegistry.get("angular")) {
    analyzerRegistry.register(new AngularAnalyzer());
  }
  if (!analyzerRegistry.get("generic")) {
    analyzerRegistry.register(new GenericAnalyzer());
  }

  return new CodebaseIndexer({
    rootPath,
    ...options,
  });
}

/**
 * Convenience function to create a searcher for an indexed codebase
 *
 * @param rootPath - Path to the indexed project root
 * @returns A configured CodebaseSearcher instance
 */
export function createSearcher(
  rootPath: string
): import("./core/search.js").CodebaseSearcher {
  const { CodebaseSearcher } = require("./core/search.js");
  return new CodebaseSearcher(rootPath);
}
