import { describe, it, expect } from 'vitest';
import { createAutoRefreshController } from '../src/core/auto-refresh.js';

describe('AutoRefreshController', () => {
  it('runs immediately when not indexing', () => {
    const controller = createAutoRefreshController();
    expect(controller.onFileChange(false)).toBe(true);
  });

  it('queues when indexing and runs after ready', () => {
    const controller = createAutoRefreshController();
    expect(controller.onFileChange(true)).toBe(false);
    expect(controller.consumeQueuedRefresh('indexing')).toBe(false);
    expect(controller.consumeQueuedRefresh('ready')).toBe(true);
  });

  it('does not run queued refresh if indexing failed', () => {
    const controller = createAutoRefreshController();
    expect(controller.onFileChange(true)).toBe(false);
    expect(controller.consumeQueuedRefresh('error')).toBe(false);
  });

  it('coalesces multiple changes into one queued refresh', () => {
    const controller = createAutoRefreshController();
    expect(controller.onFileChange(true)).toBe(false);
    expect(controller.onFileChange(true)).toBe(false);
    expect(controller.consumeQueuedRefresh('ready')).toBe(true);
    expect(controller.consumeQueuedRefresh('ready')).toBe(false);
  });
});

