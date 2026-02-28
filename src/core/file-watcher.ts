import chokidar from 'chokidar';

export interface FileWatcherOptions {
  rootPath: string;
  /** ms after last change before triggering. Default: 2000 */
  debounceMs?: number;
  /** Called once the debounce window expires after the last detected change */
  onChanged: () => void;
}

/**
 * Watch rootPath for source file changes and call onChanged (debounced).
 * Returns a stop() function that cancels the debounce timer and closes the watcher.
 */
export function startFileWatcher(opts: FileWatcherOptions): () => void {
  const { rootPath, debounceMs = 2000, onChanged } = opts;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const trigger = () => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      onChanged();
    }, debounceMs);
  };

  const watcher = chokidar.watch(rootPath, {
    ignored: [
      '**/node_modules/**',
      '**/.codebase-context/**',
      '**/.git/**',
      '**/dist/**',
      '**/.nx/**',
      '**/.planning/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.next/**',
      '**/.cache/**'
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 }
  });

  watcher
    .on('add', trigger)
    .on('change', trigger)
    .on('unlink', trigger)
    .on('error', (err: unknown) => console.error('[file-watcher] error:', err));

  return () => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    void watcher.close();
  };
}
