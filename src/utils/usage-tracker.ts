/**
 * Library Usage Tracker & Pattern Detector
 * Tracks what libraries are used and detects common coding patterns
 */

export interface LibraryUsageStats {
  [libraryPath: string]: {
    count: number;
    examples: string[];
  };
}

export interface PatternUsageStats {
  [patternName: string]: {
    primary: {
      name: string;
      count: number;
      frequency: string;
      examples: string[];
      canonicalExample?: { file: string; snippet: string };
    };
    alternatives?: Array<{
      name: string;
      count: number;
      frequency: string;
    }>;
  };
}

export interface ImportUsage {
  file: string;
  line: number;
}

export interface ComponentUsageInfo {
  definedIn?: string;
  usedIn: ImportUsage[];
  usageCount: number;
}


export class ImportGraph {
  // Map: importSource -> files that import it
  private usages: Map<string, ImportUsage[]> = new Map();
  // Map: file -> what it exports (simplified: just the file path for now)
  private exports: Map<string, string[]> = new Map();

  trackImport(importSource: string, importingFile: string, line: number = 1): void {
    // Normalize
    const normalized = this.normalizeSource(importSource);
    if (!normalized) return;

    const existing = this.usages.get(normalized) || [];
    const relPath = this.toRelativePath(importingFile);

    // Avoid duplicates
    if (!existing.some(u => u.file === relPath && u.line === line)) {
      existing.push({ file: relPath, line });
      this.usages.set(normalized, existing);
    }
  }

  trackExport(filePath: string, exportName: string): void {
    const relPath = this.toRelativePath(filePath);
    const existing = this.exports.get(relPath) || [];
    if (!existing.includes(exportName)) {
      existing.push(exportName);
      this.exports.set(relPath, existing);
    }
  }

  private normalizeSource(source: string): string | null {
    // Keep all imports except relative paths (we track those separately)
    if (source.startsWith('.')) return null;
    return source;
  }

  private toRelativePath(fullPath: string): string {
    // Take last 4 path segments for readability
    const parts = fullPath.replace(/\\/g, '/').split('/');
    return parts.slice(-4).join('/');
  }

  /**
   * Find all files that import a given source
   * This is "Find Usages" - the key value
   */
  getUsages(importSource: string): ComponentUsageInfo {
    const normalized = this.normalizeSource(importSource) || importSource;
    const usages = this.usages.get(normalized) || [];

    return {
      usedIn: usages,
      usageCount: usages.length,
    };
  }

  /**
   * Get full usage stats for all tracked imports
   */
  getAllUsages(): Record<string, ComponentUsageInfo> {
    const result: Record<string, ComponentUsageInfo> = {};

    for (const [source, usages] of this.usages.entries()) {
      result[source] = {
        usedIn: usages.slice(0, 10), // Top 10 usages
        usageCount: usages.length,
      };
    }

    return result;
  }

  /**
   * Get top N most-used imports
   */
  getTopUsed(n: number = 20): Array<{ source: string; count: number }> {
    return Array.from(this.usages.entries())
      .map(([source, usages]) => ({
        source,
        count: usages.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }
}

export class LibraryUsageTracker {
  private usage: Map<string, { count: number; examples: Set<string> }> = new Map();

  track(importSource: string, filePath: string, line: number = 1): void {
    const normalized = this.normalizeImportSource(importSource);
    if (!normalized) return;

    const existing = this.usage.get(normalized) || { count: 0, examples: new Set() };
    existing.count++;

    // Keep top 3 examples
    if (existing.examples.size < 3) {
      const relativePath = filePath.split(/[\\/]/).slice(-3).join('/');
      existing.examples.add(`${relativePath}:${line}`);
    }

    this.usage.set(normalized, existing);
  }

  private normalizeImportSource(source: string): string | null {
    // Ignore relative imports and node built-ins
    if (source.startsWith('.')) return null;
    if (['fs', 'path', 'http', 'https', 'crypto', 'util', 'events'].includes(source)) return null;

    return source;
  }


  getStats(): LibraryUsageStats {
    const stats: LibraryUsageStats = {};

    for (const [lib, data] of this.usage.entries()) {
      stats[lib] = {
        count: data.count,
        examples: Array.from(data.examples).slice(0, 3),
      };
    }

    return stats;
  }

  getTopLibraries(n: number = 10): Array<[string, number]> {
    return Array.from(this.usage.entries())
      .map(([lib, data]) => [lib, data.count] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }
}

interface TestFrameworkConfig {
  name: string;
  type: 'unit' | 'e2e';
  indicators: string[];
  priority: number;
}

export interface GoldenFile {
  file: string;
  score: number;
  patterns: {
    inject: boolean;
    signals: boolean;
    computed: boolean;
    effect: boolean;
    standalone: boolean;
    signalInputs: boolean;
  };
}

const DEFAULT_TEST_FRAMEWORK_CONFIGS: TestFrameworkConfig[] = [
  // E2E
  { name: 'Playwright', type: 'e2e', indicators: ['@playwright/test', 'page.goto(', 'page.locator('], priority: 100 },
  { name: 'Cypress', type: 'e2e', indicators: ['cy.visit(', 'cy.get(', 'cy.request(', 'cy.window('], priority: 100 },
  { name: 'Puppeteer', type: 'e2e', indicators: ['puppeteer.launch(', 'page.goto(', 'page.locator('], priority: 100 },

  // Unit - specific patterns
  { name: 'Jest', type: 'unit', indicators: ['jest.mock(', 'jest.fn(', 'jest.spyOn(', '@jest/globals', 'types/jest'], priority: 100 },
  { name: 'Vitest', type: 'unit', indicators: ['vi.mock(', 'vi.fn(', '@vitest'], priority: 100 },
  { name: 'Jasmine', type: 'unit', indicators: ['jasmine.createSpy', 'jasmine.createSpyObj'], priority: 100 },

  // Angular TestBed
  { name: 'Angular TestBed', type: 'unit', indicators: ['TestBed.configureTestingModule'], priority: 50 },

  // Generic fallback
  { name: 'Generic Test', type: 'unit', indicators: ['describe(', 'it(', 'expect('], priority: 10 },
];

export class PatternDetector {
  private patterns: Map<string, Map<string, number>> = new Map();
  private canonicalExamples: Map<string, { file: string; snippet: string }> = new Map();
  private goldenFiles: GoldenFile[] = [];
  private testFrameworkConfigs: TestFrameworkConfig[];

  constructor(customConfigs?: TestFrameworkConfig[]) {
    this.testFrameworkConfigs = customConfigs || DEFAULT_TEST_FRAMEWORK_CONFIGS;
  }

  track(category: string, patternName: string, example?: { file: string; snippet: string }): void {
    if (!this.patterns.has(category)) {
      this.patterns.set(category, new Map());
    }

    const categoryPatterns = this.patterns.get(category)!;
    categoryPatterns.set(patternName, (categoryPatterns.get(patternName) || 0) + 1);

    // Smart Canonical Example Selection
    const exampleKey = `${category}:${patternName}`;

    if (example) {
      if (!this.canonicalExamples.has(exampleKey)) {
        this.canonicalExamples.set(exampleKey, example);
      } else {
        // Check if new example is better
        const existing = this.canonicalExamples.get(exampleKey)!;

        // Priority 1: Core/Shared directories (likely definitive)
        const isCoreOrShared = (f: string) => f.includes('core/') || f.includes('shared/');
        const newIsPriority = isCoreOrShared(example.file);
        const oldIsPriority = isCoreOrShared(existing.file);

        if (newIsPriority && !oldIsPriority) {
          this.canonicalExamples.set(exampleKey, example);
        } else if (newIsPriority === oldIsPriority) {
          // Priority 2: Concise length (but not too short)
          const newLen = example.snippet.length;
          const oldLen = existing.snippet.length;

          // If current is very long (>200 chars) and new is shorter but substantial (>50), take new
          if (oldLen > 200 && newLen < oldLen && newLen > 50) {
            this.canonicalExamples.set(exampleKey, example);
          }
        }
      }
    }
  }

  /**
   * Track a file as a potential "Golden File" - a file that demonstrates multiple modern patterns
   */
  trackGoldenFile(file: string, score: number, patterns: GoldenFile['patterns']): void {
    // Check if already tracked
    const existing = this.goldenFiles.find(gf => gf.file === file);
    if (existing) {
      if (score > existing.score) {
        existing.score = score;
        existing.patterns = patterns;
      }
    } else {
      this.goldenFiles.push({ file, score, patterns });
    }
  }

  /**
   * Get top N Golden Files - files that best demonstrate all modern patterns together
   */
  getGoldenFiles(n: number = 5): GoldenFile[] {
    return this.goldenFiles
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  getConsensus(category: string): PatternUsageStats[string] | null {
    const categoryPatterns = this.patterns.get(category);
    if (!categoryPatterns || categoryPatterns.size === 0) return null;

    const total = Array.from(categoryPatterns.values()).reduce((sum, count) => sum + count, 0);
    const sorted = Array.from(categoryPatterns.entries()).sort((a, b) => b[1] - a[1]);

    const [primaryName, primaryCount] = sorted[0];
    const primaryFreq = Math.round((primaryCount / total) * 100);

    // Get canonical example for primary pattern
    const exampleKey = `${category}:${primaryName}`;
    const canonicalExample = this.canonicalExamples.get(exampleKey);

    const result: PatternUsageStats[string] = {
      primary: {
        name: primaryName,
        count: primaryCount,
        frequency: `${primaryFreq}%`,
        examples: canonicalExample ? [canonicalExample.file] : [],
        canonicalExample: canonicalExample,
      },
    };

    if (sorted.length > 1) {
      result.alternatives = sorted.slice(1, 3).map(([name, count]) => ({
        name,
        count,
        frequency: `${Math.round((count / total) * 100)}%`,
      }));
    }

    return result;
  }

  getAllPatterns(): PatternUsageStats {
    const stats: PatternUsageStats = {};

    for (const category of this.patterns.keys()) {
      const consensus = this.getConsensus(category);
      if (consensus) {
        stats[category] = consensus;
      }
    }

    return stats;
  }

  /**
   * Detect test framework from content using config-driven matching
   * Returns detected framework with confidence based on priority scoring
   */
  private detectTestFramework(content: string, filePath: string): { unit?: string; e2e?: string } {
    const results: { type: 'unit' | 'e2e'; name: string; priority: number }[] = [];

    for (const config of this.testFrameworkConfigs) {
      const matched = config.indicators.some(indicator => content.includes(indicator));
      if (matched) {
        results.push({ type: config.type, name: config.name, priority: config.priority });
      }
    }

    if (results.length === 0) return {};

    // Find highest priority match for each type
    const unitMatches = results.filter(r => r.type === 'unit').sort((a, b) => b.priority - a.priority);
    const e2eMatches = results.filter(r => r.type === 'e2e').sort((a, b) => b.priority - a.priority);

    const detected: { unit?: string; e2e?: string } = {};

    // For unit tests, apply special logic for TestBed disambiguation
    if (unitMatches.length > 0) {
      const topUnit = unitMatches[0];

      // If only TestBed or Generic Test was found, try to disambiguate
      if (topUnit.name === 'Angular TestBed' || topUnit.name === 'Generic Test') {
        if (content.includes('jest')) {
          detected.unit = 'Jest';
        } else if (content.includes('jasmine')) {
          detected.unit = 'Jasmine';
        } else if (content.includes('vitest')) {
          detected.unit = 'Vitest';
        } else {
          detected.unit = topUnit.name;
        }
      } else {
        detected.unit = topUnit.name;
      }
    }

    if (e2eMatches.length > 0) {
      detected.e2e = e2eMatches[0].name;
    }

    return detected;
  }

  /**
   * Detect patterns from code - FRAMEWORK-AGNOSTIC
   * Framework-specific patterns should be detected by framework analyzers
   */
  detectFromCode(content: string, filePath: string): void {
    // Test file detection
    if (filePath.includes('.spec.') || filePath.includes('.test.') || filePath.includes('/e2e/')) {
      const detected = this.detectTestFramework(content, filePath);

      if (detected.e2e) {
        this.track('e2eFramework', detected.e2e);
      }

      if (detected.unit) {
        this.track('unitTestFramework', detected.unit);
      }

      // Legacy testingFramework tracker for backward compatibility
      // Prioritize e2e if detected, otherwise unit
      if (detected.e2e) {
        this.track('testingFramework', detected.e2e);
      } else if (detected.unit && detected.unit !== 'Generic Test') {
        this.track('testingFramework', detected.unit);
      }

      // Track mocking style (secondary pattern)
      if (content.includes('jest.mock(') || content.includes('jest.fn(')) {
        this.track('testMocking', 'Jest mocks');
      } else if (content.includes('.spyOn(')) {
        this.track('testMocking', 'Spy-based mocking');
      } else if (content.includes('vi.mock(') || content.includes('vi.fn(')) {
        this.track('testMocking', 'Vitest mocks');
      }

      // Track testing utilities
      if (content.includes('MockComponent') || content.includes('ng-mocks')) {
        this.track('testUtility', 'ng-mocks');
      } else if (content.includes('msw') && content.includes('setupServer')) {
        this.track('testUtility', 'MSW');
      } else if (content.includes('@testing-library')) {
        this.track('testUtility', 'Testing Library');
      }
    }

    // Generic state patterns (framework-agnostic)
    if (content.includes('BehaviorSubject') || content.includes('ReplaySubject')) {
      this.track('stateManagement', 'RxJS Subjects');
    }
    if (content.includes('createStore') || content.includes('configureStore')) {
      this.track('stateManagement', 'Redux-style store');
    }
  }
}


