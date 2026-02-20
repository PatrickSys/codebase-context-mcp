import type { SearchOptions, CodebaseSearcher } from '../core/search.js';

export interface EvalQuery {
  id: number;
  query: string;
  category: string;
  expectedPatterns?: string[];
  expectedNotPatterns?: string[];
  expectedTopFiles?: string[];
  expectedNotTopFiles?: string[];
  notes?: string;
}

export interface EvalFixture {
  description?: string;
  codebase?: string;
  repository?: string;
  frozenDate?: string;
  notes?: string;
  queries: EvalQuery[];
}

export interface EvalResult {
  queryId: number;
  query: string;
  category: string;
  expectedPatterns: string[];
  expectedNotPatterns: string[];
  topFile: string | null;
  top3Files: string[];
  top1Correct: boolean;
  top3Recall: boolean;
  specContaminated: boolean;
  score: number;
}

export interface EvalSummary {
  total: number;
  top1Correct: number;
  top1Accuracy: number;
  top3RecallCount: number;
  top3Recall: number;
  specContaminatedCount: number;
  specContaminationRate: number;
  avgTopScore: number;
  gateThreshold: number;
  passesGate: boolean;
  results: EvalResult[];
}

export interface EvaluateFixtureParams {
  fixture: EvalFixture;
  searcher: CodebaseSearcher;
  limit?: number;
  searchOptions?: SearchOptions;
}

export type EvalGate = number;

export interface FormatEvalReportParams {
  codebaseLabel: string;
  fixturePath: string;
  summary: EvalSummary;
  redactPaths?: boolean;
}
