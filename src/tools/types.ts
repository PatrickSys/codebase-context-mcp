import type { CodebaseIndexer } from '../core/indexer.js';
import type { IndexingStats } from '../types/index.js';

export interface ToolPaths {
  baseDir: string;
  memory: string;
  intelligence: string;
  keywordIndex: string;
  vectorDb: string;
}

export interface IndexState {
  status: 'idle' | 'indexing' | 'ready' | 'error';
  lastIndexed?: Date;
  stats?: IndexingStats;
  error?: string;
  indexer?: CodebaseIndexer;
}

export interface ToolContext {
  indexState: IndexState;
  paths: ToolPaths;
  rootPath: string;
  performIndexing: (incrementalOnly?: boolean) => void;
}

export interface ToolResponse {
  content?: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}
