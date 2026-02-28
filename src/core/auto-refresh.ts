export interface AutoRefreshController {
  /**
   * Called when a file watcher detects a change.
   * Returns true when an incremental refresh should run immediately.
   */
  onFileChange: (isIndexing: boolean) => boolean;
  /**
   * Called after an indexing run completes.
   * Returns true when a queued incremental refresh should run next.
   */
  consumeQueuedRefresh: (indexStatus: 'ready' | 'error' | 'idle' | 'indexing') => boolean;
  /** Clears any queued refresh. */
  reset: () => void;
}

export function createAutoRefreshController(): AutoRefreshController {
  let queued = false;

  return {
    onFileChange: (isIndexing: boolean) => {
      if (isIndexing) {
        queued = true;
        return false;
      }
      return true;
    },
    consumeQueuedRefresh: (indexStatus) => {
      if (indexStatus === 'indexing') {
        // Defensive: if called while indexing, do not clear the queue.
        return false;
      }
      const shouldRun = queued && indexStatus === 'ready';
      queued = false;
      return shouldRun;
    },
    reset: () => {
      queued = false;
    }
  };
}
