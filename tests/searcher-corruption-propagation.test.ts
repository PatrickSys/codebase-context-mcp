import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { IndexCorruptedError } from '../src/errors/index.js';

const deps = vi.hoisted(() => ({
  getEmbeddingProvider: vi.fn(),
  getStorageProvider: vi.fn()
}));

vi.mock('../src/embeddings/index.js', () => ({
  getEmbeddingProvider: deps.getEmbeddingProvider
}));

vi.mock('../src/storage/index.js', () => ({
  getStorageProvider: deps.getStorageProvider
}));

describe('CodebaseSearcher IndexCorruptedError propagation', () => {
  let tempDir: string;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'searcher-test-'));
    deps.getEmbeddingProvider.mockReset();
    deps.getStorageProvider.mockReset();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await fs.writeFile(path.join(tempDir, '.codebase-index.json'), JSON.stringify([]));
    await fs.writeFile(path.join(tempDir, '.codebase-intelligence.json'), JSON.stringify({}));
  });

  afterEach(async () => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('rethrows IndexCorruptedError from initialize()', async () => {
    deps.getEmbeddingProvider.mockResolvedValue({
      embed: vi.fn(async () => [0.1, 0.2])
    });

    deps.getStorageProvider.mockRejectedValue(
      new IndexCorruptedError('LanceDB index corrupted: missing vector column')
    );

    const { CodebaseSearcher } = await import('../src/core/search.js');
    const searcher = new CodebaseSearcher(tempDir);

    await expect(searcher.search('test', 5)).rejects.toBeInstanceOf(IndexCorruptedError);
  });

  it('rethrows IndexCorruptedError from semantic search', async () => {
    deps.getEmbeddingProvider.mockResolvedValue({
      embed: vi.fn(async () => [0.1, 0.2])
    });

    deps.getStorageProvider.mockResolvedValue({
      name: 'mock',
      initialize: vi.fn(async () => {}),
      store: vi.fn(async () => {}),
      clear: vi.fn(async () => {}),
      count: vi.fn(async () => 0),
      isInitialized: vi.fn(() => true),
      search: vi.fn(async () => {
        throw new IndexCorruptedError('LanceDB index corrupted: missing vector column');
      })
    });

    const { CodebaseSearcher } = await import('../src/core/search.js');
    const searcher = new CodebaseSearcher(tempDir);

    await expect(searcher.search('test', 5)).rejects.toBeInstanceOf(IndexCorruptedError);
  });
});

