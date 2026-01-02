/**
 * Types for vector storage providers
 */

import { CodeChunk, SearchFilters } from '../types/index.js';

export interface VectorStorageProvider {
  readonly name: string;

  /**
   * Initialize the storage (create database, tables, etc.)
   */
  initialize(storagePath: string): Promise<void>;

  /**
   * Store code chunks with their embeddings
   */
  store(chunks: CodeChunkWithEmbedding[]): Promise<void>;

  /**
   * Search for similar chunks
   */
  search(
    queryVector: number[],
    limit: number,
    filters?: SearchFilters
  ): Promise<VectorSearchResult[]>;

  /**
   * Clear all stored data
   */
  clear(): Promise<void>;

  /**
   * Get count of stored chunks
   */
  count(): Promise<number>;

  /**
   * Check if storage is initialized
   */
  isInitialized(): boolean;
}

export interface CodeChunkWithEmbedding extends CodeChunk {
  embedding: number[];
}

export interface VectorSearchResult {
  chunk: CodeChunk;
  score: number;
  distance: number;
}

export interface StorageConfig {
  provider: 'lancedb';
  path: string;
}

export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  provider: 'lancedb',
  path: '.codebase-index'
};
