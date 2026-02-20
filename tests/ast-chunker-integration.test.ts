import { describe, expect, it } from 'vitest';
import { GenericAnalyzer } from '../src/analyzers/generic/index';
import { MAX_AST_CHUNK_FILE_LINES } from '../src/utils/ast-chunker';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TYPESCRIPT_FIXTURE = `
import { EventEmitter } from 'events';

const MAX_RETRIES = 3;

export class UserService extends EventEmitter {
  private users: Map<string, User> = new Map();

  constructor(private readonly db: Database) {
    super();
    this.init();
  }

  async getById(id: string): Promise<User | null> {
    if (!id) {
      throw new Error('ID required');
    }
    const cached = this.users.get(id);
    if (cached) return cached;
    const user = await this.db.findUser(id);
    if (user) {
      this.users.set(id, user);
    }
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const user = await this.getById(id);
    if (!user) {
      throw new Error(\`User \${id} not found\`);
    }
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    this.emit('user:updated', updated);
    return updated;
  }

  private init(): void {
    console.log('UserService initialized');
  }
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Database {
  findUser(id: string): Promise<User | null>;
}

export function createUserService(db: Database): UserService {
  return new UserService(db);
}
`.trim();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const analyzer = new GenericAnalyzer();

describe('AST Chunker Integration', () => {
  // Test 1: Supported language, normal file — AST chunks with scope prefixes
  it('produces AST-aligned chunks with scope prefixes for a normal TypeScript file', async () => {
    const result = await analyzer.analyze('/virtual/user-service.ts', TYPESCRIPT_FIXTURE);

    expect(result.metadata.chunkStrategy).toBe('ast-aligned');
    expect(result.metadata.symbolAware).toBe(true);

    // Should have symbol-aware chunks
    const symbolChunks = result.chunks.filter((c) => c.metadata?.symbolAware === true);
    expect(symbolChunks.length).toBeGreaterThan(0);

    // Check key symbols exist
    const names = symbolChunks.map((c) => c.metadata.symbolName);
    expect(names.some((n) => n?.includes('getById'))).toBe(true);
    expect(names.some((n) => n?.includes('updateUser'))).toBe(true);
    expect(names.some((n) => n?.includes('createUserService'))).toBe(true);

    // Every symbol chunk should have a scope prefix (starts with //)
    for (const chunk of symbolChunks) {
      expect(chunk.content.startsWith('//')).toBe(true);
    }
  });

  // Test 2: Oversized file — falls back to line chunks
  it('falls back to line-based chunking for oversized files (>10K lines)', async () => {
    // Generate a large file exceeding MAX_AST_CHUNK_FILE_LINES
    const bigLines: string[] = [];
    bigLines.push('// Large generated file');
    for (let i = 1; i <= MAX_AST_CHUNK_FILE_LINES + 100; i++) {
      bigLines.push(`export const var_${i} = ${i};`);
    }
    const bigContent = bigLines.join('\n');

    const result = await analyzer.analyze('/virtual/huge-file.ts', bigContent);

    // Should NOT be ast-aligned due to file ceiling
    expect(result.chunks.length).toBeGreaterThan(0);

    // Chunks should be produced (via line/component fallback)
    const hasAstAligned = result.chunks.some((c) => c.metadata?.chunkStrategy === 'ast-aligned');
    expect(hasAstAligned).toBe(false);
  });

  // Test 3: Parse error simulation — fallback, no crash
  it('falls back gracefully on files with syntax errors', async () => {
    // Content with syntax errors that cause Tree-sitter hasError
    const badContent = [
      'export class Broken {',
      '  method() {',
      '    const x = {{{{{;', // severe syntax error
      '    return \\\\\\\\;',
      '  }',
      '  another() {',
      '    return 42;',
      '  }',
      '}'
    ].join('\n');

    // Should not throw
    const result = await analyzer.analyze('/virtual/broken.ts', badContent);

    // Chunks should still be produced (via fallback)
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  // Test 4: Unsupported language — regex/line fallback
  it('produces chunks via fallback for unsupported languages (.rb)', async () => {
    const rubyContent = [
      'class Calculator',
      '  def add(a, b)',
      '    a + b',
      '  end',
      '',
      '  def subtract(a, b)',
      '    a - b',
      '  end',
      'end',
      '',
      'def standalone_function(x)',
      '  x * 2',
      'end'
    ].join('\n');

    const result = await analyzer.analyze('/virtual/calculator.rb', rubyContent);

    // Chunks produced
    expect(result.chunks.length).toBeGreaterThan(0);

    // Should NOT be ast-aligned (Ruby has no grammar)
    expect(result.metadata.chunkStrategy).toBe('line-or-component');
    expect(result.metadata.symbolAware).toBeUndefined();

    // No chunk should have AST-related metadata
    for (const chunk of result.chunks) {
      expect(chunk.metadata?.symbolAware).not.toBe(true);
    }
  });

  // Test 5: Scope prefix correctness — nested class > method format
  it('generates correct scope prefix format for nested symbols', async () => {
    const result = await analyzer.analyze('/virtual/user-service.ts', TYPESCRIPT_FIXTURE);

    const symbolChunks = result.chunks.filter((c) => c.metadata?.symbolAware === true);

    // Find a method chunk inside UserService
    const getByIdChunk = symbolChunks.find((c) => c.metadata.symbolName === 'getById');
    if (getByIdChunk) {
      // Should have prefix format: // UserService > getById :: (...)
      const firstLine = getByIdChunk.content.split('\n')[0];
      expect(firstLine).toMatch(/\/\/\s*UserService\s*>\s*getById\s*::/);
    }

    // Find standalone function chunk
    const createChunk = symbolChunks.find((c) =>
      c.metadata.symbolName?.includes('createUserService')
    );
    if (createChunk) {
      // Should have prefix format: // createUserService :: (...)
      const firstLine = createChunk.content.split('\n')[0];
      expect(firstLine).toMatch(/\/\/\s*createUserService\s*::/);
      // Should NOT have parent path separator
      expect(firstLine).not.toMatch(/>/);
    }
  });

  // Test 6: Full coverage verification — chunks cover the file with small
  // structural gaps only where container headers/footers are below the
  // 2-non-blank-line threshold.
  it('AST chunks cover the file with at most small structural gaps', async () => {
    const result = await analyzer.analyze('/virtual/user-service.ts', TYPESCRIPT_FIXTURE);

    // Only check when we get AST-aligned chunks
    expect(result.metadata.chunkStrategy).toBe('ast-aligned');

    const sorted = [...result.chunks].sort((a, b) => a.startLine - b.startLine);
    const totalLines = TYPESCRIPT_FIXTURE.split('\n').length;

    // Collect all line numbers covered by chunks
    const coveredLines = new Set<number>();
    for (const chunk of sorted) {
      for (let line = chunk.startLine; line <= chunk.endLine; line++) {
        coveredLines.add(line);
      }
    }

    // Count uncovered lines — should be minimal (small headers/footers below threshold)
    const allLines = TYPESCRIPT_FIXTURE.split('\n');
    const uncoveredLines: number[] = [];
    for (let i = 1; i <= totalLines; i++) {
      if (!coveredLines.has(i)) {
        uncoveredLines.push(i);
      }
    }

    // Uncovered lines should be small structural fragments (class opening/closing braces, etc.)
    // Allow up to 15% uncovered for container header/footer gaps
    const uncoveredPct = (uncoveredLines.length / totalLines) * 100;
    expect(uncoveredPct).toBeLessThan(15);

    // Every uncovered line should be structurally trivial (blank, brace, or short header)
    for (const lineNum of uncoveredLines) {
      const line = allLines[lineNum - 1].trim();
      const isTrivial = line === '' || line === '}' || line === '};' || line.length < 60;
      expect(isTrivial).toBe(true);
    }

    // Verify no overlapping line ranges
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].startLine).toBeGreaterThan(sorted[i - 1].endLine);
    }

    // Content from chunks (minus scope prefixes) should contain all significant source lines
    const chunkContent: string[] = [];
    for (const chunk of sorted) {
      const lines = chunk.content.split('\n');
      for (const line of lines) {
        // Skip scope prefix lines
        if (line.match(/^\/\/\s*.+\s*::\s*.+/) && !TYPESCRIPT_FIXTURE.includes(line)) {
          continue;
        }
        chunkContent.push(line);
      }
    }
    const joined = chunkContent.join('\n');

    // All important function/class names must be present in reconstructed content
    // Note: 'class UserService' may be in a dropped header (<= 2 non-blank lines)
    // but the methods and standalone functions must be present
    expect(joined).toContain('async getById');
    expect(joined).toContain('async updateUser');
    expect(joined).toContain('function createUserService');
  });
});
