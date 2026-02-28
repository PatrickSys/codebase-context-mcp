import type { CodebaseIndexer } from '../core/indexer.js';
import type { IndexingStats } from '../types/index.js';

export interface DecisionCard {
  ready: boolean;
  nextAction?: string;
  warnings?: string[];
  patterns?: {
    do?: string[];
    avoid?: string[];
  };
  bestExample?: string;
  impact?: {
    coverage?: string;
    files?: string[];
  };
  whatWouldHelp?: string[];
}

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

// --- Search response types ---
export interface SearchQuality {
  status: 'ok' | 'low_confidence';
  confidence: number | string;
  hint?: string;
}

export interface SearchResultItem {
  file: string; // "path:startLine-endLine"
  summary: string;
  score: number;
  type?: string; // "componentType:layer"
  trend?: 'Rising' | 'Declining';
  patternWarning?: string;
  relationships?: {
    importedByCount?: number;
    hasTests?: boolean;
  };
  hints?: {
    callers?: string[];
    consumers?: string[];
    tests?: string[];
  };
  snippet?: string;
}

export interface SearchResponse {
  status: string;
  searchQuality: SearchQuality;
  preflight?: DecisionCard;
  results: SearchResultItem[];
  totalResults: number;
  relatedMemories?: string[];
}

// --- Pattern response types ---
export interface PatternEntry {
  name: string;
  frequency: string;
  trend?: string;
  adoption?: string;
}

export interface PatternCategory {
  primary: PatternEntry;
  alsoDetected?: PatternEntry[];
}

export interface PatternConflict {
  category: string;
  primary: { name: string; adoption: string; trend?: string };
  alternative: { name: string; adoption: string; trend?: string };
}

export interface GoldenFile {
  file: string;
  score: number;
}

export interface PatternResponse {
  patterns: Record<string, PatternCategory>;
  goldenFiles?: GoldenFile[];
  memories?: Array<{ type: string; memory: string }>;
  conflicts?: PatternConflict[];
}

// --- Metadata response types ---
export interface MetadataDependency {
  name: string;
  version?: string;
  category?: string;
}

export interface MetadataFramework {
  name?: string;
  version?: string;
  stateManagement?: string[];
  testingFrameworks?: string[];
  uiLibraries?: string[];
}

export interface MetadataLanguage {
  name?: string;
  percentage?: number;
  fileCount?: number;
  lineCount?: number;
}

export interface MetadataStatistics {
  totalFiles?: number;
  totalLines?: number;
  totalComponents?: number;
}

export interface MetadataInner {
  name?: string;
  framework?: MetadataFramework;
  languages?: MetadataLanguage[];
  dependencies?: MetadataDependency[];
  architecture?: { type?: string; modules?: Array<{ name: string }> };
  projectStructure?: { type?: string };
  statistics?: MetadataStatistics;
}

export interface MetadataResponse {
  status?: string;
  metadata?: MetadataInner;
}

// --- Style guide response types ---
export interface StyleGuideResult {
  file?: string;
  relevantSections?: string[];
}

export interface StyleGuideResponse {
  status?: string;           // 'success' | 'no_results'
  query?: string;
  category?: string;
  results?: StyleGuideResult[];
  totalFiles?: number;
  totalMatches?: number;
  limited?: boolean;
  notice?: string;
  // no_results shape:
  message?: string;
  hint?: string;
  searchedPatterns?: string[];
}

// --- Cycles response types ---
export interface CycleItem {
  files?: string[];
  cycle?: string[];
  severity?: string;
}

export interface GraphStats {
  files?: number;
  edges?: number;
  avgDependencies?: number;
}

export interface CyclesResponse {
  cycles?: CycleItem[];
  graphStats?: GraphStats;
}

// --- Refs response types ---
export interface RefsUsage {
  file: string;
  line: number;
  preview: string;
}

export interface RefsResponse {
  symbol: string;
  usageCount: number;
  confidence: string;
  usages: RefsUsage[];
}
