import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { startFileWatcher } from '../src/core/file-watcher.js';

describe('FileWatcher', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-watcher-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('triggers onChanged after debounce window', async () => {
    const debounceMs = 400;
    let callCount = 0;

    const stop = startFileWatcher({
      rootPath: tempDir,
      debounceMs,
      onChanged: () => { callCount++; },
    });

    try {
      // Give chokidar a moment to finish initializing before the first write
      await new Promise((resolve) => setTimeout(resolve, 100));
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'export const x = 1;');
      // Wait for chokidar to pick up the event (including awaitWriteFinish stabilityThreshold)
      // + debounce window + OS scheduling slack
      await new Promise((resolve) => setTimeout(resolve, debounceMs + 1000));
      expect(callCount).toBe(1);
    } finally {
      stop();
    }
  }, 8000);

  it('debounces rapid changes into a single callback', async () => {
    const debounceMs = 300;
    let callCount = 0;

    const stop = startFileWatcher({
      rootPath: tempDir,
      debounceMs,
      onChanged: () => { callCount++; },
    });

    try {
      // Give chokidar a moment to finish initializing before the first write
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Write 5 files in quick succession — all within the debounce window
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(path.join(tempDir, `file${i}.ts`), `export const x${i} = ${i};`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      // Wait for debounce to settle
      await new Promise((resolve) => setTimeout(resolve, debounceMs + 400));
      expect(callCount).toBe(1);
    } finally {
      stop();
    }
  }, 8000);

  it('stop() cancels a pending callback', async () => {
    const debounceMs = 500;
    let callCount = 0;

    const stop = startFileWatcher({
      rootPath: tempDir,
      debounceMs,
      onChanged: () => { callCount++; },
    });

    // Give chokidar a moment to finish initializing before the first write
    await new Promise((resolve) => setTimeout(resolve, 100));
    await fs.writeFile(path.join(tempDir, 'cancel.ts'), 'export const y = 99;');
    // Let chokidar detect the event (including awaitWriteFinish stabilityThreshold)
    // but stop before the debounce window expires.
    await new Promise((resolve) => setTimeout(resolve, 350));
    stop();
    // Wait past where debounce would have fired
    await new Promise((resolve) => setTimeout(resolve, debounceMs + 200));
    expect(callCount).toBe(0);
  }, 5000);

  it('ignores changes to non-tracked file extensions', async () => {
    const debounceMs = 250;
    let callCount = 0;

    const stop = startFileWatcher({
      rootPath: tempDir,
      debounceMs,
      onChanged: () => {
        callCount++;
      }
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await fs.writeFile(path.join(tempDir, 'notes.txt'), 'this should be ignored');
      await new Promise((resolve) => setTimeout(resolve, debounceMs + 700));
      expect(callCount).toBe(0);
    } finally {
      stop();
    }
  }, 5000);
});
