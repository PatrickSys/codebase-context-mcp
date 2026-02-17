import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const searchMocks = vi.hoisted(() => ({
  search: vi.fn()
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

describe('search_codebase preflight', () => {
  let tempRoot: string | null = null;
  let originalArgv: string[] | null = null;
  let originalEnvRoot: string | undefined;

  beforeEach(async () => {
    searchMocks.search.mockReset();
    vi.resetModules();

    originalArgv = [...process.argv];
    originalEnvRoot = process.env.CODEBASE_ROOT;

    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'codebase-context-edit-preflight-'));
    process.env.CODEBASE_ROOT = tempRoot;
    process.argv[2] = tempRoot;

    // Seed intelligence so preflight can render without indexing.
    const ctxDir = path.join(tempRoot, '.codebase-context');
    await fs.mkdir(ctxDir, { recursive: true });
    await fs.writeFile(
      path.join(ctxDir, 'intelligence.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          internalFileGraph: {
            imports: {
              'src/app/app.config.ts': ['src/auth/auth.interceptor.ts'],
              'src/app/api/api.service.ts': ['src/auth/auth.interceptor.ts'],
              'src/app/feature/feature.ts': ['src/auth/auth.interceptor.ts'],
              'src/app/other.ts': ['src/auth/auth.interceptor.ts']
            }
          },
          patterns: {},
          goldenFiles: []
        },
        null,
        2
      )
    );
  });

  afterEach(async () => {
    if (originalArgv) process.argv = originalArgv;
    if (originalEnvRoot === undefined) {
      delete process.env.CODEBASE_ROOT;
    } else {
      process.env.CODEBASE_ROOT = originalEnvRoot;
    }

    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it('returns preflight with ready flag when intent is omitted (intelligence present)', async () => {
    searchMocks.search.mockResolvedValueOnce([
      {
        summary: 'Auth interceptor implementation',
        snippet: 'intercept(req, next) { ... }',
        filePath: 'src/auth/auth.interceptor.ts',
        startLine: 1,
        endLine: 20,
        score: 0.42,
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
          query: 'How does this app attach the auth token to outgoing API calls?'
        }
      }
    });

    const payload = JSON.parse(response.content[0].text);
    expect(payload.status).toBe('success');
    // Preflight is flattened to { ready, reason }
    expect(payload.preflight).toBeTruthy();
    expect(typeof payload.preflight.ready).toBe('boolean');
  });

  it('returns preflight with ready flag when intent="edit"', async () => {
    searchMocks.search.mockResolvedValueOnce([
      {
        summary: 'Auth interceptor implementation',
        snippet: 'intercept(req, next) { ... }',
        filePath: 'src/auth/auth.interceptor.ts',
        startLine: 1,
        endLine: 20,
        score: 0.42,
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
          query: 'How does this app attach the auth token to outgoing API calls?',
          intent: 'edit'
        }
      }
    });

    const payload = JSON.parse(response.content[0].text);
    expect(payload.status).toBe('success');
    // Preflight is flattened to { ready, reason }
    expect(payload.preflight).toBeTruthy();
    expect(typeof payload.preflight.ready).toBe('boolean');
  });
});

