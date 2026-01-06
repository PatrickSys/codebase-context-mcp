import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { IndexCorruptedError } from '../src/errors/index.js';

const lancedb = vi.hoisted(() => ({
  connect: vi.fn()
}));

vi.mock('@lancedb/lancedb', () => ({
  connect: lancedb.connect
}));

describe('LanceDBStorageProvider corruption detection', () => {
  let tempDir: string;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lancedb-test-'));
    lancedb.connect.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleErrorSpy.mockRestore();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('throws IndexCorruptedError when vector column missing during initialize()', async () => {
    const dropTable = vi.fn(async () => {});
    const db = {
      tableNames: vi.fn(async () => ['code_chunks']),
      openTable: vi.fn(async () => ({
        schema: vi.fn(async () => ({ fields: [{ name: 'id' }] }))
      })),
      dropTable
    };

    lancedb.connect.mockResolvedValue(db);

    const { LanceDBStorageProvider } = await import('../src/storage/lancedb.js');
    const provider = new LanceDBStorageProvider();

    await expect(provider.initialize(tempDir)).rejects.toBeInstanceOf(IndexCorruptedError);
    expect(dropTable).toHaveBeenCalledWith('code_chunks');
  });

  it('throws IndexCorruptedError when schema validation fails during initialize()', async () => {
    const dropTable = vi.fn(async () => {});
    const db = {
      tableNames: vi.fn(async () => ['code_chunks']),
      openTable: vi.fn(async () => ({
        schema: vi.fn(async () => {
          throw new Error('schema error');
        })
      })),
      dropTable
    };

    lancedb.connect.mockResolvedValue(db);

    const { LanceDBStorageProvider } = await import('../src/storage/lancedb.js');
    const provider = new LanceDBStorageProvider();

    await expect(provider.initialize(tempDir)).rejects.toBeInstanceOf(IndexCorruptedError);
    expect(dropTable).toHaveBeenCalledWith('code_chunks');
  });

  it('throws IndexCorruptedError when vector search fails with "No vector column"', async () => {
    const { LanceDBStorageProvider } = await import('../src/storage/lancedb.js');
    const provider = new LanceDBStorageProvider() as any;

    const query = {
      limit: vi.fn(() => query),
      where: vi.fn(() => query),
      toArray: vi.fn(async () => {
        throw new Error('Schema Error: No vector column found to create index');
      })
    };

    provider.initialized = true;
    provider.table = {
      vectorSearch: vi.fn(() => query)
    };

    await expect(provider.search([0.1, 0.2], 5)).rejects.toBeInstanceOf(IndexCorruptedError);
  });
});

