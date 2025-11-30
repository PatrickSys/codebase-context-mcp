/**
 * Library Usage Tracker & Pattern Detector
 * Tracks what libraries are used and detects common coding patterns
 */

export interface LibraryUsageStats {
  [libraryPath: string]: {
    count: number;
    examples: string[];
    category?: 'ui' | 'utility' | 'state' | 'testing' | 'custom' | 'framework' | 'other';
  };
}

export interface PatternUsageStats {
  [patternName: string]: {
    primary: {
      name: string;
      count: number;
      frequency: string;
      examples: string[];
    };
    alternatives?: Array<{
      name: string;
      count: number;
      frequency: string;
    }>;
  };
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

  private categorizeLibrary(libName: string): string {
    const name = libName.toLowerCase();

    // UI libraries - check first before framework catch-all
    if (name.includes('primeng') ||
        name.includes('prime/') ||  // @codeblue/prime/*
        name.includes('material') ||
        name.includes('antd') ||
        name.includes('ant-design') ||
        name.includes('syncfusion') ||
        name.includes('devextreme')) {
      return 'ui';
    }
    if (name.includes('ngrx') || name.includes('redux') || name.includes('rxjs')) {
      return 'state';
    }
    if (name.includes('jest') || name.includes('jasmine') || name.includes('vitest')) {
      return 'testing';
    }
    // Framework core libs (but NOT UI component libraries)
    if ((name.includes('angular') || name.includes('react') || name.includes('vue')) &&
        !name.includes('syncfusion') &&
        !name.includes('material')) {
      return 'framework';
    }
    if (libName.startsWith('@') && !libName.startsWith('@angular') && !libName.startsWith('@react')) {
      return 'custom';
    }
    if (name.includes('lodash') || name.includes('date-fns') || name.includes('moment')) {
      return 'utility';
    }

    return 'other';
  }

  getStats(): LibraryUsageStats {
    const stats: LibraryUsageStats = {};

    for (const [lib, data] of this.usage.entries()) {
      stats[lib] = {
        count: data.count,
        examples: Array.from(data.examples).slice(0, 3),
        category: this.categorizeLibrary(lib) as any,
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

export class PatternDetector {
  private patterns: Map<string, Map<string, number>> = new Map();

  track(category: string, patternName: string): void {
    if (!this.patterns.has(category)) {
      this.patterns.set(category, new Map());
    }

    const categoryPatterns = this.patterns.get(category)!;
    categoryPatterns.set(patternName, (categoryPatterns.get(patternName) || 0) + 1);
  }

  getConsensus(category: string): PatternUsageStats[string] | null {
    const categoryPatterns = this.patterns.get(category);
    if (!categoryPatterns || categoryPatterns.size === 0) return null;

    const total = Array.from(categoryPatterns.values()).reduce((sum, count) => sum + count, 0);
    const sorted = Array.from(categoryPatterns.entries()).sort((a, b) => b[1] - a[1]);

    const [primaryName, primaryCount] = sorted[0];
    const primaryFreq = Math.round((primaryCount / total) * 100);

    const result: PatternUsageStats[string] = {
      primary: {
        name: primaryName,
        count: primaryCount,
        frequency: `${primaryFreq}%`,
        examples: [],
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

  detectFromCode(content: string, filePath: string): void {
    // Test mocking patterns
    if (filePath.includes('.spec.') || filePath.includes('.test.')) {
      if (content.includes('jest.mock(')) {
        this.track('httpMocking', 'Jest manual mocks');
      } else if (content.includes('TestBed') && content.includes('spyOn')) {
        this.track('httpMocking', 'TestBed spy');
      } else if (content.includes('jasmine.createSpy')) {
        this.track('httpMocking', 'Jasmine spy');
      }
    }

    // Dependency injection (Angular)
    if (filePath.endsWith('.component.ts') || filePath.endsWith('.service.ts')) {
      if (content.includes('inject(')) {
        this.track('dependencyInjection', 'inject() function');
      } else if (content.includes('constructor(') && content.includes('private')) {
        this.track('dependencyInjection', 'Constructor injection');
      }
    }

    // Component inputs (Angular)
    if (filePath.endsWith('.component.ts')) {
      if (content.includes('input(') || content.includes('input.required(')) {
        this.track('componentInputs', 'Signal-based inputs');
      } else if (content.includes('@Input()')) {
        this.track('componentInputs', 'Decorator-based @Input');
      }
    }

    // State management
    if (content.includes('BehaviorSubject') || content.includes('ReplaySubject')) {
      this.track('stateManagement', 'RxJS Subjects');
    } else if (content.includes('signal(') || content.includes('computed(')) {
      this.track('stateManagement', 'Angular Signals');
    } else if (content.includes('Store')) {
      this.track('stateManagement', 'NgRx Store');
    }
  }
}
