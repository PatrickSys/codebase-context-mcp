import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  CODEBASE_CONTEXT_DIRNAME,
  INDEX_FORMAT_VERSION,
  INDEX_META_FILENAME,
  INDEX_META_VERSION,
  KEYWORD_INDEX_FILENAME
} from '../src/constants/codebase-context.js';

describe('get_symbol_references MCP tool', () => {
  let tempRoot: string | null = null;
  let originalArgv: string[] | null = null;
  let originalEnvRoot: string | undefined;

  beforeEach(async () => {
    vi.resetModules();

    originalArgv = [...process.argv];
    originalEnvRoot = process.env.CODEBASE_ROOT;

    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'codebase-context-symbol-refs-'));
    process.env.CODEBASE_ROOT = tempRoot;
    process.argv[2] = tempRoot;
  });

  afterEach(async () => {
    if (originalArgv) {
      process.argv = originalArgv;
    }

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

  it('registers get_symbol_references in TOOLS', async () => {
    const { TOOLS } = await import('../src/index.js');
    expect(TOOLS.some((tool) => tool.name === 'get_symbol_references')).toBe(true);
  });

  it('returns usageCount and top usages from keyword index', async () => {
    if (!tempRoot) {
      throw new Error('tempRoot not initialized');
    }

    const contextDir = path.join(tempRoot, CODEBASE_CONTEXT_DIRNAME);
    await fs.mkdir(contextDir, { recursive: true });

    const buildId = 'test-build-symbol-refs';
    const generatedAt = new Date().toISOString();

    await fs.mkdir(path.join(contextDir, 'index'), { recursive: true });
    await fs.writeFile(
      path.join(contextDir, 'index', 'index-build.json'),
      JSON.stringify({ buildId, formatVersion: INDEX_FORMAT_VERSION }),
      'utf-8'
    );

    const chunks = [
      {
        content: 'export function alpha() {\n  return beta(alpha);\n}',
        startLine: 10,
        relativePath: 'src/a.ts'
      },
      {
        content: 'const beta = alpha + 1;\n',
        startLine: 2,
        relativePath: 'src/b.ts'
      }
    ];

    await fs.writeFile(
      path.join(contextDir, KEYWORD_INDEX_FILENAME),
      JSON.stringify({ header: { buildId, formatVersion: INDEX_FORMAT_VERSION }, chunks }),
      'utf-8'
    );

    await fs.writeFile(
      path.join(contextDir, INDEX_META_FILENAME),
      JSON.stringify(
        {
          metaVersion: INDEX_META_VERSION,
          formatVersion: INDEX_FORMAT_VERSION,
          buildId,
          generatedAt,
          toolVersion: 'test',
          artifacts: {
            keywordIndex: { path: KEYWORD_INDEX_FILENAME },
            vectorDb: { path: 'index', provider: 'lancedb' }
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    const { server } = await import('../src/index.js');
    const handler = (server as any)._requestHandlers.get('tools/call');

    const response = await handler({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'get_symbol_references',
        arguments: {
          symbol: 'alpha',
          limit: 2
        }
      }
    });

    const payload = JSON.parse(response.content[0].text);
    expect(payload.status).toBe('success');
    expect(payload.usageCount).toBeGreaterThan(0);
    expect(payload.usages.length).toBeLessThanOrEqual(2);
    expect(payload.confidence).toBe('syntactic');
    expect(typeof payload.isComplete).toBe('boolean');

    for (const usage of payload.usages) {
      expect(usage.file).toBeTypeOf('string');
      expect(usage.line).toBeTypeOf('number');
      expect(usage.preview).toBeTypeOf('string');
      expect(usage.preview.length).toBeGreaterThan(0);
    }
  });

  it('isComplete is true when results are less than limit', async () => {
    if (!tempRoot) {
      throw new Error('tempRoot not initialized');
    }

    const contextDir = path.join(tempRoot, CODEBASE_CONTEXT_DIRNAME);
    await fs.mkdir(contextDir, { recursive: true });

    const buildId = 'test-build-isComplete-true';
    const generatedAt = new Date().toISOString();

    await fs.mkdir(path.join(contextDir, 'index'), { recursive: true });
    await fs.writeFile(
      path.join(contextDir, 'index', 'index-build.json'),
      JSON.stringify({ buildId, formatVersion: INDEX_FORMAT_VERSION }),
      'utf-8'
    );

    const chunks = [
      {
        content: 'export function alpha() {\n  return alpha;\n}',
        startLine: 1,
        relativePath: 'src/test.ts'
      }
    ];

    await fs.writeFile(
      path.join(contextDir, KEYWORD_INDEX_FILENAME),
      JSON.stringify({ header: { buildId, formatVersion: INDEX_FORMAT_VERSION }, chunks }),
      'utf-8'
    );

    await fs.writeFile(
      path.join(contextDir, INDEX_META_FILENAME),
      JSON.stringify(
        {
          metaVersion: INDEX_META_VERSION,
          formatVersion: INDEX_FORMAT_VERSION,
          buildId,
          generatedAt,
          toolVersion: 'test',
          artifacts: {
            keywordIndex: { path: KEYWORD_INDEX_FILENAME },
            vectorDb: { path: 'index', provider: 'lancedb' }
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    const { server } = await import('../src/index.js');
    const handler = (server as any)._requestHandlers.get('tools/call');

    const response = await handler({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'get_symbol_references',
        arguments: {
          symbol: 'alpha',
          limit: 10
        }
      }
    });

    const payload = JSON.parse(response.content[0].text);
    expect(payload.status).toBe('success');
    expect(payload.isComplete).toBe(true);
    expect(payload.usageCount).toBeLessThan(10);
  });

  it('isComplete is false when results equal or exceed limit', async () => {
    if (!tempRoot) {
      throw new Error('tempRoot not initialized');
    }

    const contextDir = path.join(tempRoot, CODEBASE_CONTEXT_DIRNAME);

    // Clear previous test data
    await fs.rm(contextDir, { recursive: true, force: true });
    await fs.mkdir(contextDir, { recursive: true });

    const buildId = 'test-build-isComplete-false';
    const generatedAt = new Date().toISOString();

    await fs.mkdir(path.join(contextDir, 'index'), { recursive: true });
    await fs.writeFile(
      path.join(contextDir, 'index', 'index-build.json'),
      JSON.stringify({ buildId, formatVersion: INDEX_FORMAT_VERSION }),
      'utf-8'
    );

    // Create a chunk with many matches
    const content = 'foo foo foo foo foo foo foo foo foo foo foo';
    const chunks = [
      {
        content,
        startLine: 1,
        relativePath: 'src/test.ts'
      }
    ];

    await fs.writeFile(
      path.join(contextDir, KEYWORD_INDEX_FILENAME),
      JSON.stringify({ header: { buildId, formatVersion: INDEX_FORMAT_VERSION }, chunks }),
      'utf-8'
    );

    await fs.writeFile(
      path.join(contextDir, INDEX_META_FILENAME),
      JSON.stringify(
        {
          metaVersion: INDEX_META_VERSION,
          formatVersion: INDEX_FORMAT_VERSION,
          buildId,
          generatedAt,
          toolVersion: 'test',
          artifacts: {
            keywordIndex: { path: KEYWORD_INDEX_FILENAME },
            vectorDb: { path: 'index', provider: 'lancedb' }
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    const { server } = await import('../src/index.js');
    const handler = (server as any)._requestHandlers.get('tools/call');

    const response = await handler({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'get_symbol_references',
        arguments: {
          symbol: 'foo',
          limit: 5
        }
      }
    });

    const payload = JSON.parse(response.content[0].text);
    expect(payload.status).toBe('success');
    expect(payload.isComplete).toBe(false);
    expect(payload.usageCount).toBeGreaterThanOrEqual(5);
    expect(payload.usages.length).toBeLessThanOrEqual(5);
  });
});
