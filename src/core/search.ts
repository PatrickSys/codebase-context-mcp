/**
 * Hybrid search combining semantic vector search with keyword matching
 */

import Fuse from 'fuse.js';
import path from 'path';
import { promises as fs } from 'fs';
import { CodeChunk, SearchResult, SearchFilters } from '../types/index.js';
import { EmbeddingProvider, getEmbeddingProvider } from '../embeddings/index.js';
import { VectorStorageProvider, getStorageProvider } from '../storage/index.js';
import { analyzerRegistry } from './analyzer-registry.js';

export interface SearchOptions {
  useSemanticSearch?: boolean;
  useKeywordSearch?: boolean;
  semanticWeight?: number;
  keywordWeight?: number;
}

const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  useSemanticSearch: true,
  useKeywordSearch: true,
  semanticWeight: 0.7,
  keywordWeight: 0.3,
};

export class CodebaseSearcher {
  private rootPath: string;
  private storagePath: string;

  private fuseIndex: Fuse<CodeChunk> | null = null;
  private chunks: CodeChunk[] = [];

  private embeddingProvider: EmbeddingProvider | null = null;
  private storageProvider: VectorStorageProvider | null = null;

  private initialized = false;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.storagePath = path.join(rootPath, '.codebase-index');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadKeywordIndex();

      this.embeddingProvider = await getEmbeddingProvider();
      this.storageProvider = await getStorageProvider({ path: this.storagePath });

      this.initialized = true;
    } catch (error) {
      console.warn('Partial initialization (keyword search only):', error);
      this.initialized = true;
    }
  }

  private async loadKeywordIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.rootPath, '.codebase-index.json');
      const content = await fs.readFile(indexPath, 'utf-8');
      this.chunks = JSON.parse(content);

      this.fuseIndex = new Fuse(this.chunks, {
        keys: [
          { name: 'content', weight: 0.4 },
          { name: 'metadata.componentName', weight: 0.25 },
          { name: 'filePath', weight: 0.15 },
          { name: 'relativePath', weight: 0.15 },
          { name: 'componentType', weight: 0.15 },
          { name: 'layer', weight: 0.1 },
          { name: 'tags', weight: 0.15 },
        ],
        includeScore: true,
        threshold: 0.4,
        useExtendedSearch: true,
        ignoreLocation: true,
      });
    } catch (error) {
      console.warn('Keyword index load failed:', error);
      this.chunks = [];
      this.fuseIndex = null;
    }
  }

  async search(
    query: string,
    limit: number = 10,
    filters?: SearchFilters,
    options: SearchOptions = DEFAULT_SEARCH_OPTIONS
  ): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const { useSemanticSearch, useKeywordSearch, semanticWeight, keywordWeight } = {
      ...DEFAULT_SEARCH_OPTIONS,
      ...options,
    };

    const results: Map<string, { chunk: CodeChunk; scores: number[] }> = new Map();

    if (useSemanticSearch && this.embeddingProvider && this.storageProvider) {
      try {
        const vectorResults = await this.semanticSearch(query, limit * 2, filters);

        vectorResults.forEach((result) => {
          const id = result.chunk.id;
          const existing = results.get(id);

          if (existing) {
            existing.scores.push(result.score * (semanticWeight || 0.7));
          } else {
            results.set(id, {
              chunk: result.chunk,
              scores: [result.score * (semanticWeight || 0.7)],
            });
          }
        });
      } catch (error) {
        console.warn('Semantic search failed:', error);
      }
    }

    if (useKeywordSearch && this.fuseIndex) {
      try {
        const keywordResults = await this.keywordSearch(query, limit * 2, filters);

        keywordResults.forEach((result) => {
          const id = result.chunk.id;
          const existing = results.get(id);

          if (existing) {
            existing.scores.push(result.score * (keywordWeight || 0.3));
          } else {
            results.set(id, {
              chunk: result.chunk,
              scores: [result.score * (keywordWeight || 0.3)],
            });
          }
        });
      } catch (error) {
        console.warn('Keyword search failed:', error);
      }
    }

    const combinedResults: SearchResult[] = Array.from(results.entries())
      .map(([id, { chunk, scores }]) => {
        const combinedScore = scores.reduce((sum, score) => sum + score, 0);

        const summary = this.generateSummary(chunk);
        const snippet = this.generateSnippet(chunk.content, 500);

        return {
          summary,
          snippet,
          filePath: chunk.filePath,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          score: combinedScore,
          relevanceReason: this.generateRelevanceReason(chunk, query),
          language: chunk.language,
          framework: chunk.framework,
          componentType: chunk.componentType,
          layer: chunk.layer,
          metadata: chunk.metadata,
        } as SearchResult;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return combinedResults;
  }

  private generateSummary(chunk: CodeChunk): string {
    const analyzer = chunk.framework
      ? analyzerRegistry.get(chunk.framework)
      : null;

    if (analyzer && analyzer.summarize) {
      try {
        return analyzer.summarize(chunk);
      } catch (error) {
        console.warn('Analyzer summary failed:', error);
      }
    }

    const fileName = path.basename(chunk.filePath);
    return `${chunk.language || 'Code'} in ${fileName}${chunk.componentType ? ` (${chunk.componentType})` : ''}: lines ${chunk.startLine}-${chunk.endLine}`;
  }

  private generateSnippet(content: string, maxWords: number = 500): string {
    const words = content.split(/\s+/);
    if (words.length <= maxWords) {
      return content;
    }

    const snippet = words.slice(0, maxWords).join(' ');
    const remaining = words.length - maxWords;
    return `${snippet}\n\n... [${remaining} more words]`;
  }

  private async semanticSearch(
    query: string,
    limit: number,
    filters?: SearchFilters
  ): Promise<{ chunk: CodeChunk; score: number }[]> {
    if (!this.embeddingProvider || !this.storageProvider) {
      return [];
    }

    const queryVector = await this.embeddingProvider.embed(query);

    const results = await this.storageProvider.search(queryVector, limit, filters);

    return results.map(r => ({
      chunk: r.chunk,
      score: r.score,
    }));
  }

  private async keywordSearch(
    query: string,
    limit: number,
    filters?: SearchFilters
  ): Promise<{ chunk: CodeChunk; score: number }[]> {
    if (!this.fuseIndex || this.chunks.length === 0) {
      return [];
    }

    let fuseResults = this.fuseIndex.search(query);

    if (filters) {
      fuseResults = fuseResults.filter(r => {
        const chunk = r.item;

        if (filters.componentType && chunk.componentType !== filters.componentType) {
          return false;
        }
        if (filters.layer && chunk.layer !== filters.layer) {
          return false;
        }
        if (filters.framework && chunk.framework !== filters.framework) {
          return false;
        }
        if (filters.language && chunk.language !== filters.language) {
          return false;
        }
        if (filters.tags && filters.tags.length > 0) {
          const chunkTags = chunk.tags || [];
          if (!filters.tags.some(tag => chunkTags.includes(tag))) {
            return false;
          }
        }

        return true;
      });
    }

    return fuseResults.slice(0, limit).map(r => {
      const chunk = r.item;
      let score = 1 - (r.score || 0);
      
      // Boost exact matches on class name or file path
      const queryLower = query.toLowerCase();
      const fileName = path.basename(chunk.filePath).toLowerCase();
      const relativePathLower = chunk.relativePath.toLowerCase();
      const componentName = chunk.metadata?.componentName?.toLowerCase() || '';
      
      // Exact class name match
      if (componentName && queryLower === componentName) {
        score = Math.min(1.0, score + 0.3);
      }
      
      // Exact file name match
      if (fileName === queryLower || fileName.replace(/\.ts$/, '') === queryLower.replace(/\.ts$/, '')) {
        score = Math.min(1.0, score + 0.2);
      }
      
      // File path contains query
      if (chunk.filePath.toLowerCase().includes(queryLower) || relativePathLower.includes(queryLower)) {
        score = Math.min(1.0, score + 0.1);
      }
      
      return {
        chunk,
        score,
      };
    });
  }

  private generateRelevanceReason(chunk: CodeChunk, query: string): string {
    const reasons: string[] = [];

    if (chunk.componentType) {
      reasons.push(`${chunk.componentType}`);
    }

    if (chunk.layer) {
      reasons.push(`${chunk.layer} layer`);
    }

    const queryLower = query.toLowerCase();
    const matchingTags = (chunk.tags || []).filter(tag =>
      queryLower.includes(tag.toLowerCase())
    );
    if (matchingTags.length > 0) {
      reasons.push(`tags: ${matchingTags.join(', ')}`);
    }

    return reasons.length > 0 ? reasons.join('; ') : 'content match';
  }

  async getChunkCount(): Promise<number> {
    if (this.storageProvider) {
      return await this.storageProvider.count();
    }
    return this.chunks.length;
  }

  isReady(): boolean {
    return this.initialized;
  }
}
