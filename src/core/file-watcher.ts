/**
 * File Watcher for Incremental Index Updates
 * 
 * Watches for file changes in the codebase and triggers selective re-indexing.
 * Uses debouncing to avoid excessive re-indexing on rapid changes.
 */

import { watch, FSWatcher, promises as fs, statSync } from "fs";
import path from "path";
import { EventEmitter } from "events";

export interface FileWatcherOptions {
    /** Root path to watch */
    rootPath: string;
    /** Debounce delay in milliseconds (default: 2000ms) */
    debounceMs?: number;
    /** File extensions to watch (default: ts, tsx, js, jsx, json) */
    extensions?: string[];
    /** Patterns to ignore (glob-like) */
    ignorePatterns?: string[];
    /** Enable verbose logging */
    verbose?: boolean;
}

export interface FileChangeEvent {
    type: "add" | "change" | "delete";
    filePath: string;
    relativePath: string;
    timestamp: Date;
}

export type FileWatcherCallback = (changes: FileChangeEvent[]) => void;

const DEFAULT_OPTIONS: Required<Omit<FileWatcherOptions, "rootPath">> = {
    debounceMs: 2000,
    extensions: ["ts", "tsx", "js", "jsx", "json", "html", "scss", "css"],
    ignorePatterns: [
        "node_modules",
        "dist",
        ".git",
        ".codebase-index",
        ".codebase-index.json",
        ".codebase-intelligence.json",
        "*.spec.ts", // Watch tests separately if needed
        "*.test.ts",
    ],
    verbose: false,
};

export class FileWatcher extends EventEmitter {
    private rootPath: string;
    private options: Required<Omit<FileWatcherOptions, "rootPath">>;
    private watchers: Map<string, FSWatcher> = new Map();
    private pendingChanges: Map<string, FileChangeEvent> = new Map();
    private debounceTimer: NodeJS.Timeout | null = null;
    private isRunning = false;
    private stats = {
        filesWatched: 0,
        changesDetected: 0,
        reindexTriggered: 0,
    };

    constructor(options: FileWatcherOptions) {
        super();
        this.rootPath = path.resolve(options.rootPath);
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Start watching the codebase for changes
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            this.log("Watcher already running");
            return;
        }

        this.log(`Starting file watcher on: ${this.rootPath}`);
        this.isRunning = true;

        try {
            await this.watchDirectory(this.rootPath);
            this.log(`Watching ${this.stats.filesWatched} directories`);
            this.emit("started", { directories: this.stats.filesWatched });
        } catch (error) {
            this.isRunning = false;
            this.emit("error", error);
            throw error;
        }
    }

    /**
     * Stop watching for changes
     */
    stop(): void {
        if (!this.isRunning) return;

        this.log("Stopping file watcher");

        // Close all watchers
        for (const [dir, watcher] of this.watchers) {
            watcher.close();
        }
        this.watchers.clear();

        // Clear pending changes
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.pendingChanges.clear();

        this.isRunning = false;
        this.emit("stopped");
    }

    /**
     * Get current statistics
     */
    getStats(): typeof this.stats {
        return { ...this.stats };
    }

    /**
     * Check if watcher is active
     */
    isActive(): boolean {
        return this.isRunning;
    }

    private async watchDirectory(dir: string): Promise<void> {
        // Skip ignored directories
        const relativePath = path.relative(this.rootPath, dir);
        if (this.shouldIgnore(relativePath)) {
            return;
        }

        try {
            // Watch this directory
            const watcher = watch(dir, { persistent: true }, (eventType, filename) => {
                if (!filename) return;

                const filePath = path.join(dir, filename);
                this.handleFileChange(eventType as "change" | "rename", filePath);
            });

            watcher.on("error", (error) => {
                this.log(`Watcher error on ${dir}: ${error.message}`);
                // Remove broken watcher
                this.watchers.delete(dir);
            });

            this.watchers.set(dir, watcher);
            this.stats.filesWatched++;

            // Recursively watch subdirectories
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    await this.watchDirectory(path.join(dir, entry.name));
                }
            }
        } catch (error) {
            // Directory might not exist or be inaccessible
            this.log(`Could not watch ${dir}: ${error}`);
        }
    }

    private handleFileChange(eventType: "change" | "rename", filePath: string): void {
        const relativePath = path.relative(this.rootPath, filePath);

        // Skip ignored files
        if (this.shouldIgnore(relativePath)) {
            return;
        }

        // Skip if not a watched extension
        const ext = path.extname(filePath).slice(1);
        if (!this.options.extensions.includes(ext)) {
            return;
        }

        // Determine change type
        let changeType: FileChangeEvent["type"];
        try {
            statSync(filePath);
            changeType = eventType === "rename" ? "add" : "change";
        } catch {
            changeType = "delete";
        }

        const event: FileChangeEvent = {
            type: changeType,
            filePath,
            relativePath,
            timestamp: new Date(),
        };

        this.pendingChanges.set(filePath, event);
        this.stats.changesDetected++;
        this.log(`Detected ${changeType}: ${relativePath}`);

        // Debounce the re-index trigger
        this.scheduleFlush();
    }

    private scheduleFlush(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.flushChanges();
        }, this.options.debounceMs);
    }

    private flushChanges(): void {
        if (this.pendingChanges.size === 0) return;

        const changes = Array.from(this.pendingChanges.values());
        this.pendingChanges.clear();
        this.stats.reindexTriggered++;

        this.log(`Flushing ${changes.length} changes`);
        this.emit("changes", changes);
    }

    private shouldIgnore(relativePath: string): boolean {
        // Simple pattern matching (not full glob)
        for (const pattern of this.options.ignorePatterns) {
            if (pattern.startsWith("*")) {
                // Extension match: *.spec.ts
                const suffix = pattern.slice(1);
                if (relativePath.endsWith(suffix)) {
                    return true;
                }
            } else if (relativePath.includes(pattern)) {
                // Directory/path match
                return true;
            }
        }
        return false;
    }

    private log(message: string): void {
        if (this.options.verbose) {
            console.error(`[FileWatcher] ${message}`);
        }
    }
}

/**
 * Create and configure a file watcher
 */
export function createFileWatcher(
    rootPath: string,
    onChanges: FileWatcherCallback,
    options?: Partial<Omit<FileWatcherOptions, "rootPath">>
): FileWatcher {
    const watcher = new FileWatcher({ rootPath, ...options });

    watcher.on("changes", onChanges);

    return watcher;
}
