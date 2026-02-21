#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * MCP Server for Codebase Context
 * Provides codebase indexing and semantic search capabilities
 */

import { promises as fs } from 'fs';

import path from 'path';
import { glob } from 'glob';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  Resource
} from '@modelcontextprotocol/sdk/types.js';
import { CodebaseIndexer } from './core/indexer.js';
import type {
  IndexingStats,
  SearchResult,
  RelationshipData,
  Memory,
  MemoryCategory,
  MemoryType
} from './types/index.js';
import { CodebaseSearcher } from './core/search.js';
import { analyzerRegistry } from './core/analyzer-registry.js';
import { AngularAnalyzer } from './analyzers/angular/index.js';
import { GenericAnalyzer } from './analyzers/generic/index.js';
import { InternalFileGraph } from './utils/usage-tracker.js';
import { IndexCorruptedError } from './errors/index.js';
import {
  CODEBASE_CONTEXT_DIRNAME,
  MEMORY_FILENAME,
  INTELLIGENCE_FILENAME,
  KEYWORD_INDEX_FILENAME,
  VECTOR_DB_DIRNAME
} from './constants/codebase-context.js';
import {
  appendMemoryFile,
  readMemoriesFile,
  filterMemories,
  applyUnfilteredLimit,
  withConfidence
} from './memory/store.js';
import { handleMemoryCli } from './cli.js';
import { parseGitLogLineToMemory } from './memory/git-memory.js';
import { buildEvidenceLock } from './preflight/evidence-lock.js';
import { shouldIncludePatternConflictCategory } from './preflight/query-scope.js';
import {
  isComplementaryPatternCategory,
  isComplementaryPatternConflict,
  shouldSkipLegacyTestingFrameworkCategory
} from './patterns/semantics.js';
import { CONTEXT_RESOURCE_URI, isContextResourceUri } from './resources/uri.js';
import { assessSearchQuality } from './core/search-quality.js';
import { findSymbolReferences } from './core/symbol-references.js';
import { readIndexMeta, validateIndexArtifacts } from './core/index-meta.js';
import { TOOLS, dispatchTool, type ToolContext } from './tools/index.js';

analyzerRegistry.register(new AngularAnalyzer());
analyzerRegistry.register(new GenericAnalyzer());

// Resolve root path with validation
function resolveRootPath(): string {
  const arg = process.argv[2];
  const envPath = process.env.CODEBASE_ROOT;

  // Priority: CLI arg > env var > cwd
  let rootPath = arg || envPath || process.cwd();
  rootPath = path.resolve(rootPath);

  // Warn if using cwd as fallback (guarded to avoid stderr during MCP STDIO handshake)
  if (!arg && !envPath && process.env.CODEBASE_CONTEXT_DEBUG) {
    console.error(`[DEBUG] No project path specified. Using current directory: ${rootPath}`);
    console.error(`[DEBUG] Hint: Specify path as CLI argument or set CODEBASE_ROOT env var`);
  }

  return rootPath;
}

const ROOT_PATH = resolveRootPath();

// File paths (new structure)
const PATHS = {
  baseDir: path.join(ROOT_PATH, CODEBASE_CONTEXT_DIRNAME),
  memory: path.join(ROOT_PATH, CODEBASE_CONTEXT_DIRNAME, MEMORY_FILENAME),
  intelligence: path.join(ROOT_PATH, CODEBASE_CONTEXT_DIRNAME, INTELLIGENCE_FILENAME),
  keywordIndex: path.join(ROOT_PATH, CODEBASE_CONTEXT_DIRNAME, KEYWORD_INDEX_FILENAME),
  vectorDb: path.join(ROOT_PATH, CODEBASE_CONTEXT_DIRNAME, VECTOR_DB_DIRNAME)
};

const LEGACY_PATHS = {
  intelligence: path.join(ROOT_PATH, '.codebase-intelligence.json'),
  keywordIndex: path.join(ROOT_PATH, '.codebase-index.json'),
  vectorDb: path.join(ROOT_PATH, '.codebase-index')
};

export const INDEX_CONSUMING_TOOL_NAMES = [
  'search_codebase',
  'get_symbol_references',
  'get_component_usage',
  'detect_circular_dependencies',
  'get_team_patterns',
  'get_codebase_metadata'
] as const;

export const INDEX_CONSUMING_RESOURCE_NAMES = ['Codebase Intelligence'] as const;

type IndexStatus = 'ready' | 'rebuild-required' | 'indexing' | 'unknown';
type IndexConfidence = 'high' | 'low';
type IndexAction = 'served' | 'rebuild-started' | 'rebuilt-and-served' | 'rebuild-failed';

export type IndexSignal = {
  status: IndexStatus;
  confidence: IndexConfidence;
  action: IndexAction;
  reason?: string;
};

async function requireValidIndex(rootPath: string): Promise<IndexSignal> {
  const meta = await readIndexMeta(rootPath);
  await validateIndexArtifacts(rootPath, meta);

  // Optional artifact presence informs confidence.
  const hasIntelligence = await fileExists(PATHS.intelligence);

  return {
    status: 'ready',
    confidence: hasIntelligence ? 'high' : 'low',
    action: 'served',
    ...(hasIntelligence ? {} : { reason: 'Optional intelligence artifact missing' })
  };
}

async function ensureValidIndexOrAutoHeal(): Promise<IndexSignal> {
  if (indexState.status === 'indexing') {
    return {
      status: 'indexing',
      confidence: 'low',
      action: 'served',
      reason: 'Indexing in progress'
    };
  }

  try {
    return await requireValidIndex(ROOT_PATH);
  } catch (error) {
    if (error instanceof IndexCorruptedError) {
      const reason = error.message;
      console.error(`[Index] ${reason}`);
      console.error('[Auto-Heal] Triggering full re-index...');

      await performIndexing();

      if (indexState.status === 'ready') {
        try {
          let validated = await requireValidIndex(ROOT_PATH);
          validated = { ...validated, action: 'rebuilt-and-served', reason };
          return validated;
        } catch (revalidateError) {
          const msg =
            revalidateError instanceof Error ? revalidateError.message : String(revalidateError);
          return {
            status: 'rebuild-required',
            confidence: 'low',
            action: 'rebuild-failed',
            reason: `Auto-heal completed but index did not validate: ${msg}`
          };
        }
      }

      return {
        status: 'rebuild-required',
        confidence: 'low',
        action: 'rebuild-failed',
        reason: `Auto-heal failed: ${indexState.error || reason}`
      };
    }

    throw error;
  }
}

/**
 * Check if file/directory exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Migrate legacy file structure to .codebase-context/ folder.
 * Idempotent, fail-safe. Rollback compatibility is not required.
 */
async function migrateToNewStructure(): Promise<boolean> {
  let migrated = false;

  try {
    await fs.mkdir(PATHS.baseDir, { recursive: true });

    // intelligence.json
    if (!(await fileExists(PATHS.intelligence))) {
      if (await fileExists(LEGACY_PATHS.intelligence)) {
        await fs.copyFile(LEGACY_PATHS.intelligence, PATHS.intelligence);
        migrated = true;
        if (process.env.CODEBASE_CONTEXT_DEBUG) {
          console.error('[DEBUG] Migrated intelligence.json');
        }
      }
    }

    // index.json (keyword index)
    if (!(await fileExists(PATHS.keywordIndex))) {
      if (await fileExists(LEGACY_PATHS.keywordIndex)) {
        await fs.copyFile(LEGACY_PATHS.keywordIndex, PATHS.keywordIndex);
        migrated = true;
        if (process.env.CODEBASE_CONTEXT_DEBUG) {
          console.error('[DEBUG] Migrated index.json');
        }
      }
    }

    // Vector DB directory
    if (!(await fileExists(PATHS.vectorDb))) {
      if (await fileExists(LEGACY_PATHS.vectorDb)) {
        await fs.rename(LEGACY_PATHS.vectorDb, PATHS.vectorDb);
        migrated = true;
        if (process.env.CODEBASE_CONTEXT_DEBUG) {
          console.error('[DEBUG] Migrated vector database');
        }
      }
    }

    return migrated;
  } catch (error) {
    if (process.env.CODEBASE_CONTEXT_DEBUG) {
      console.error('[DEBUG] Migration error:', error);
    }
    return false;
  }
}

export interface IndexState {
  status: 'idle' | 'indexing' | 'ready' | 'error';
  lastIndexed?: Date;
  stats?: IndexingStats;
  error?: string;
  indexer?: CodebaseIndexer;
}

// Read version from package.json so it never drifts
const PKG_VERSION: string = JSON.parse(
  await fs.readFile(new URL('../package.json', import.meta.url), 'utf-8')
).version;

const indexState: IndexState = {
  status: 'idle'
};

const server: Server = new Server(
  {
    name: 'codebase-context',
    version: PKG_VERSION
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// MCP Resources - Proactive context injection
const RESOURCES: Resource[] = [
  {
    uri: CONTEXT_RESOURCE_URI,
    name: 'Codebase Intelligence',
    description:
      'Automatic codebase context: libraries used, team patterns, and conventions. ' +
      'Read this BEFORE generating code to follow team standards.',
    mimeType: 'text/plain'
  }
];

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: RESOURCES };
});

async function generateCodebaseContext(): Promise<string> {
  const intelligencePath = PATHS.intelligence;

  const index = await ensureValidIndexOrAutoHeal();
  if (index.status === 'indexing') {
    return (
      '# Codebase Intelligence\n\n' +
      'Index is still being built. Retry in a moment.\n\n' +
      `Index: ${index.status} (${index.confidence}, ${index.action})` +
      (index.reason ? `\nReason: ${index.reason}` : '')
    );
  }
  if (index.action === 'rebuild-failed') {
    return (
      '# Codebase Intelligence\n\n' +
      'Index rebuild required before intelligence can be served.\n\n' +
      `Index: ${index.status} (${index.confidence}, ${index.action})` +
      (index.reason ? `\nReason: ${index.reason}` : '')
    );
  }

  try {
    const content = await fs.readFile(intelligencePath, 'utf-8');
    const intelligence = JSON.parse(content);

    const lines: string[] = [];
    lines.push('# Codebase Intelligence');
    lines.push('');
    lines.push(
      `Index: ${index.status} (${index.confidence}, ${index.action})${index.reason ? ` — ${index.reason}` : ''
      }`
    );
    lines.push('');
    lines.push('WARNING: This is what YOUR codebase actually uses, not generic recommendations.');
    lines.push('These are FACTS from analyzing your code, not best practices from the internet.');
    lines.push('');

    // Library usage - sorted by count
    const libraryEntries = Object.entries(intelligence.libraryUsage || {})
      .map(([lib, data]: [string, any]) => ({
        lib,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count);

    if (libraryEntries.length > 0) {
      lines.push('## Libraries Actually Used (Top 15)');
      lines.push('');

      for (const { lib, count } of libraryEntries.slice(0, 15)) {
        lines.push(`- **${lib}** (${count} uses)`);
      }
      lines.push('');
    }

    // Show tsconfig paths if available (helps AI understand internal imports)
    if (intelligence.tsconfigPaths && Object.keys(intelligence.tsconfigPaths).length > 0) {
      lines.push('## Import Aliases (from tsconfig.json)');
      lines.push('');
      lines.push('These path aliases map to internal project code:');
      for (const [alias, paths] of Object.entries(intelligence.tsconfigPaths)) {
        lines.push(`- \`${alias}\` -> ${(paths as string[]).join(', ')}`);
      }
      lines.push('');
    }

    // Pattern consensus
    if (intelligence.patterns && Object.keys(intelligence.patterns).length > 0) {
      const patterns = intelligence.patterns as Record<string, any>;
      lines.push("## YOUR Codebase's Actual Patterns (Not Generic Best Practices)");
      lines.push('');
      lines.push('These patterns were detected by analyzing your actual code.');
      lines.push('This is what YOUR team does in practice, not what tutorials recommend.');
      lines.push('');

      for (const [category, data] of Object.entries(patterns)) {
        if (shouldSkipLegacyTestingFrameworkCategory(category, patterns)) {
          continue;
        }

        const patternData: any = data;
        const primary = patternData.primary;
        const alternatives = patternData.alsoDetected ?? [];

        if (!primary) continue;

        if (
          isComplementaryPatternCategory(
            category,
            [primary.name, ...alternatives.map((alt: any) => alt.name)].filter(Boolean)
          )
        ) {
          const secondary = alternatives[0];
          if (secondary) {
            const categoryName = category
              .replace(/([A-Z])/g, ' $1')
              .trim()
              .replace(/^./, (str: string) => str.toUpperCase());
            lines.push(
              `### ${categoryName}: **${primary.name}** (${primary.frequency}) + **${secondary.name}** (${secondary.frequency})`
            );
            lines.push(
              '   -> Computed and effect are complementary Signals primitives and are commonly used together.'
            );
            lines.push('   -> Treat this as balanced usage, not a hard split decision.');
            lines.push('');
            continue;
          }
        }

        const percentage = parseInt(primary.frequency);
        const categoryName = category
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .replace(/^./, (str: string) => str.toUpperCase());

        if (percentage === 100) {
          lines.push(`### ${categoryName}: **${primary.name}** (${primary.frequency} - unanimous)`);
          lines.push(`   -> Your codebase is 100% consistent - ALWAYS use ${primary.name}`);
        } else if (percentage >= 80) {
          lines.push(
            `### ${categoryName}: **${primary.name}** (${primary.frequency} - strong consensus)`
          );
          lines.push(`   -> Your team strongly prefers ${primary.name}`);
          if (alternatives.length) {
            const alt = alternatives[0];
            lines.push(
              `   -> Minority pattern: ${alt.name} (${alt.frequency}) - avoid for new code`
            );
          }
        } else if (percentage >= 60) {
          lines.push(`### ${categoryName}: **${primary.name}** (${primary.frequency} - majority)`);
          lines.push(`   -> Most code uses ${primary.name}, but not unanimous`);
          if (alternatives.length) {
            lines.push(
              `   -> Also detected: ${alternatives[0].name} (${alternatives[0].frequency})`
            );
          }
        } else {
          // Split decision
          lines.push(`### ${categoryName}: WARNING: NO TEAM CONSENSUS`);
          lines.push(`   Your codebase is split between multiple approaches:`);
          lines.push(`   - ${primary.name} (${primary.frequency})`);
          if (alternatives.length) {
            for (const alt of alternatives.slice(0, 2)) {
              lines.push(`   - ${alt.name} (${alt.frequency})`);
            }
          }
          lines.push(`   -> ASK the team which approach to use for new features`);
        }
        lines.push('');
      }
    }

    lines.push('---');
    lines.push(`Generated: ${intelligence.generatedAt || new Date().toISOString()}`);

    return lines.join('\n');
  } catch (error) {
    return (
      '# Codebase Intelligence\n\n' +
      'Intelligence data not yet generated. Run indexing first.\n' +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (isContextResourceUri(uri)) {
    const content = await generateCodebaseContext();

    return {
      contents: [
        {
          uri: CONTEXT_RESOURCE_URI,
          mimeType: 'text/plain',
          text: content
        }
      ]
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

/**
 * Extract memories from conventional git commits (refactor:, migrate:, fix:, revert:).
 * Scans last 90 days. Deduplicates via content hash. Zero friction alternative to manual memory.
 */
async function extractGitMemories(): Promise<number> {
  // Quick check: skip if not a git repo
  if (!(await fileExists(path.join(ROOT_PATH, '.git')))) return 0;

  const { execSync } = await import('child_process');

  let log: string;
  try {
    // Format: ISO-date<TAB>hash subject  (e.g. "2026-01-15T10:00:00+00:00\tabc1234 fix: race condition")
    log = execSync('git log --format="%aI\t%h %s" --since="90 days ago" --no-merges', {
      cwd: ROOT_PATH,
      encoding: 'utf-8',
      timeout: 5000
    }).trim();
  } catch {
    // Git not available or command failed — silently skip
    return 0;
  }

  if (!log) return 0;

  const lines = log.split('\n').filter(Boolean);
  let added = 0;

  for (const line of lines) {
    const parsedMemory = parseGitLogLineToMemory(line);
    if (!parsedMemory) continue;

    const result = await appendMemoryFile(PATHS.memory, parsedMemory);
    if (result.status === 'added') added++;
  }

  return added;
}

async function performIndexing(incrementalOnly?: boolean): Promise<void> {
  indexState.status = 'indexing';
  const mode = incrementalOnly ? 'incremental' : 'full';
  console.error(`Indexing (${mode}): ${ROOT_PATH}`);

  try {
    let lastLoggedProgress = { phase: '', percentage: -1 };
    const indexer = new CodebaseIndexer({
      rootPath: ROOT_PATH,
      incrementalOnly,
      onProgress: (progress) => {
        // Only log when phase or percentage actually changes (prevents duplicate logs)
        const shouldLog =
          progress.phase !== lastLoggedProgress.phase ||
          (progress.percentage % 10 === 0 && progress.percentage !== lastLoggedProgress.percentage);

        if (shouldLog) {
          console.error(`[${progress.phase}] ${progress.percentage}%`);
          lastLoggedProgress = { phase: progress.phase, percentage: progress.percentage };
        }
      }
    });

    indexState.indexer = indexer;
    const stats = await indexer.index();

    indexState.status = 'ready';
    indexState.lastIndexed = new Date();
    indexState.stats = stats;

    console.error(
      `Complete: ${stats.indexedFiles} files, ${stats.totalChunks} chunks in ${(
        stats.duration / 1000
      ).toFixed(2)}s`
    );

    // Auto-extract memories from git history (non-blocking, best-effort)
    try {
      const gitMemories = await extractGitMemories();
      if (gitMemories > 0) {
        console.error(
          `[git-memory] Extracted ${gitMemories} new memor${gitMemories === 1 ? 'y' : 'ies'} from git history`
        );
      }
    } catch {
      // Git memory extraction is optional — never fail indexing over it
    }
  } catch (error) {
    indexState.status = 'error';
    indexState.error = error instanceof Error ? error.message : String(error);
    console.error('Indexing failed:', indexState.error);
  }
}

async function shouldReindex(): Promise<boolean> {
  const indexPath = PATHS.keywordIndex;
  try {
    await fs.access(indexPath);
    return false;
  } catch {
    return true;
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Gate INDEX_CONSUMING tools on a valid, healthy index
    let indexSignal: IndexSignal | undefined;
    if ((INDEX_CONSUMING_TOOL_NAMES as readonly string[]).includes(name)) {
      if (indexState.status === "indexing") {
        return {
          content: [{ type: "text", text: JSON.stringify({
            status: "indexing",
            message: "Index build in progress — please retry shortly",
          }) }],
        };
      }
      if (indexState.status === "error") {
        return {
          content: [{ type: "text", text: JSON.stringify({
            status: "error",
            message: `Indexer error: ${indexState.error}`,
          }) }],
        };
      }
      indexSignal = await ensureValidIndexOrAutoHeal();
      if (indexSignal.action === "rebuild-failed") {
        return {
          content: [{ type: "text", text: JSON.stringify({
            error: "Index is corrupt and could not be rebuilt automatically.",
            index: indexSignal,
          }) }],
          isError: true,
        };
      }
    }

    const ctx: ToolContext = {
      indexState,
      paths: PATHS,
      rootPath: ROOT_PATH,
      performIndexing,
    };

    const result = await dispatchTool(name, args ?? {}, ctx);

    // Inject IndexSignal into response so callers can inspect index health
    if (indexSignal !== undefined && result.content?.[0]) {
      try {
        const parsed = JSON.parse(result.content[0].text);
        result.content[0] = { type: 'text', text: JSON.stringify({ ...parsed, index: indexSignal }) };
      } catch { /* response wasn't JSON, skip injection */ }
    }

    return result;
  } catch (error) {
    return {
      content: [{ type: "text", text: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
});

async function main() {
  // Validate root path exists and is a directory
  try {
    const stats = await fs.stat(ROOT_PATH);
    if (!stats.isDirectory()) {
      console.error(`ERROR: Root path is not a directory: ${ROOT_PATH}`);
      console.error(`Please specify a valid project directory.`);
      process.exit(1);
    }
  } catch (_error) {
    console.error(`ERROR: Root path does not exist: ${ROOT_PATH}`);
    console.error(`Please specify a valid project directory.`);
    process.exit(1);
  }

  // Migrate legacy structure before server starts
  try {
    const migrated = await migrateToNewStructure();
    if (migrated && process.env.CODEBASE_CONTEXT_DEBUG) {
      console.error('[DEBUG] Migrated to .codebase-context/ structure');
    }
  } catch (error) {
    // Non-fatal: continue with current paths
    if (process.env.CODEBASE_CONTEXT_DEBUG) {
      console.error('[DEBUG] Migration failed:', error);
    }
  }

  // Server startup banner (guarded to avoid stderr during MCP STDIO handshake)
  if (process.env.CODEBASE_CONTEXT_DEBUG) {
    console.error('[DEBUG] Codebase Context MCP Server');
    console.error(`[DEBUG] Root: ${ROOT_PATH}`);
    console.error(
      `[DEBUG] Analyzers: ${analyzerRegistry
        .getAll()
        .map((a) => a.name)
        .join(', ')}`
    );
  }

  // Check for package.json to confirm it's a project root (guarded to avoid stderr during handshake)
  if (process.env.CODEBASE_CONTEXT_DEBUG) {
    try {
      await fs.access(path.join(ROOT_PATH, 'package.json'));
      console.error(`[DEBUG] Project detected: ${path.basename(ROOT_PATH)}`);
    } catch {
      console.error(`[DEBUG] WARNING: No package.json found. This may not be a project root.`);
    }
  }

  const needsIndex = await shouldReindex();

  if (needsIndex) {
    if (process.env.CODEBASE_CONTEXT_DEBUG) console.error('[DEBUG] Starting indexing...');
    performIndexing();
  } else {
    if (process.env.CODEBASE_CONTEXT_DEBUG) console.error('[DEBUG] Index found. Ready.');
    indexState.status = 'ready';
    indexState.lastIndexed = new Date();
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  if (process.env.CODEBASE_CONTEXT_DEBUG) console.error('[DEBUG] Server ready');
}

// Export server components for programmatic use
export { server, performIndexing, resolveRootPath, shouldReindex, TOOLS };

// Only auto-start when run directly as CLI (not when imported as module)
// Check if this module is the entry point
const isDirectRun =
  process.argv[1]?.replace(/\\/g, '/').endsWith('index.js') ||
  process.argv[1]?.replace(/\\/g, '/').endsWith('index.ts');

if (isDirectRun) {
  // CLI subcommand: memory list/add/remove
  if (process.argv[2] === 'memory') {
    handleMemoryCli(process.argv.slice(3)).catch((error) => {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  } else {
    main().catch((error) => {
      console.error('Fatal:', error);
      process.exit(1);
    });
  }
}
