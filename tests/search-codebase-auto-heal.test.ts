import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const searchMocks = vi.hoisted(() => ({
  search: vi.fn()
}));

const indexerMocks = vi.hoisted(() => ({
  index: vi.fn()
}));

vi.mock('../src/core/search.js', async () => {
  class CodebaseSearcher {
    constructor(_rootPath: string) {}

    async search(query: string, limit: number, filters?: unknown) {
      return searchMocks.search(query, limit, filters);
    }
  }

  return { CodebaseSearcher };
});

vi.mock('../src/core/indexer.js', () => {
  class CodebaseIndexer {
    constructor(_options: unknown) {}

    getProgress() {
      return { phase: 'complete', percentage: 100 };
    }

    async index() {
      indexerMocks.index();
      return {
        totalFiles: 0,
        indexedFiles: 0,
        skippedFiles: 0,
        totalChunks: 0,
        totalLines: 0,
        duration: 0,
        avgChunkSize: 0,
        componentsByType: {},
        componentsByLayer: {
          presentation: 0,
          business: 0,
          data: 0,
          state: 0,
          core: 0,
          shared: 0,
          feature: 0,
          infrastructure: 0,
          unknown: 0
        },
        errors: [],
        startedAt: new Date(),
        completedAt: new Date()
      };
    }
  }

  return { CodebaseIndexer };
});

describe('search_codebase auto-heal', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    searchMocks.search.mockReset();
    indexerMocks.index.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('triggers indexing and retries when IndexCorruptedError is thrown', async () => {
    const { IndexCorruptedError } = await import('../src/errors/index.js');

    searchMocks.search
      .mockRejectedValueOnce(new IndexCorruptedError('LanceDB index corrupted: missing vector column'))
      .mockResolvedValueOnce([
        {
          summary: 'Test summary',
          snippet: 'Test snippet',
          filePath: '/tmp/file.ts',
          startLine: 1,
          endLine: 2,
          score: 0.9,
          language: 'ts',
          metadata: {}
        }
      ]);

    const { server } = await import('../src/index.js');
    const handler = (server as any)._requestHandlers.get('tools/call');

    const response = await handler({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'search_codebase',
        arguments: {
          query: 'test'
        }
      }
    });

    const payload = JSON.parse(response.content[0].text);
    expect(payload.status).toBe('success');
    expect(payload.results).toHaveLength(1);
    expect(searchMocks.search).toHaveBeenCalledTimes(2);
    expect(indexerMocks.index).toHaveBeenCalledTimes(1);
  });
});

