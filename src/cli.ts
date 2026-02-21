/**
 * CLI subcommands for codebase-context.
 * Memory list/add/remove — vendor-neutral access without any AI agent.
 * search/metadata/status/reindex/style-guide/patterns/refs/cycles — all MCP tools.
 */

import path from 'path';
import { promises as fs } from 'fs';
import type { Memory, MemoryCategory, MemoryType } from './types/index.js';
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
  removeMemory,
  filterMemories,
  withConfidence
} from './memory/store.js';
import { CodebaseIndexer } from './core/indexer.js';
import { dispatchTool } from './tools/index.js';
import type { ToolContext } from './tools/index.js';
import type { IndexState } from './tools/types.js';
import { analyzerRegistry } from './core/analyzer-registry.js';
import { AngularAnalyzer } from './analyzers/angular/index.js';
import { GenericAnalyzer } from './analyzers/generic/index.js';

analyzerRegistry.register(new AngularAnalyzer());
analyzerRegistry.register(new GenericAnalyzer());

const _CLI_COMMANDS = [
  'memory',
  'search',
  'metadata',
  'status',
  'reindex',
  'style-guide',
  'patterns',
  'refs',
  'cycles'
] as const;

type CliCommand = (typeof _CLI_COMMANDS)[number];

function printUsage(): void {
  console.log('codebase-context <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  memory <list|add|remove>           Memory CRUD');
  console.log('  search --query <q>                 Search the indexed codebase');
  console.log('         [--intent explore|edit|refactor|migrate]');
  console.log('         [--limit <n>] [--lang <l>] [--framework <f>] [--layer <l>]');
  console.log('  metadata                           Project structure, frameworks, deps');
  console.log('  status                             Index state and progress');
  console.log('  reindex [--incremental] [--reason <r>]  Re-index the codebase');
  console.log('  style-guide [--query <q>] [--category <c>]  Style guide rules');
  console.log('  patterns [--category all|di|state|testing|libraries]  Team patterns');
  console.log('  refs --symbol <name> [--limit <n>]  Symbol references');
  console.log('  cycles [--scope <path>]            Circular dependency detection');
  console.log('');
  console.log('Global flags:');
  console.log('  --json    Output raw JSON (default: human-readable)');
  console.log('  --help    Show this help');
  console.log('');
  console.log('Environment:');
  console.log('  CODEBASE_ROOT    Project root path (default: cwd)');
}

async function initToolContext(): Promise<ToolContext> {
  const rootPath = path.resolve(process.env.CODEBASE_ROOT || process.cwd());

  const paths = {
    baseDir: path.join(rootPath, CODEBASE_CONTEXT_DIRNAME),
    memory: path.join(rootPath, CODEBASE_CONTEXT_DIRNAME, MEMORY_FILENAME),
    intelligence: path.join(rootPath, CODEBASE_CONTEXT_DIRNAME, INTELLIGENCE_FILENAME),
    keywordIndex: path.join(rootPath, CODEBASE_CONTEXT_DIRNAME, KEYWORD_INDEX_FILENAME),
    vectorDb: path.join(rootPath, CODEBASE_CONTEXT_DIRNAME, VECTOR_DB_DIRNAME)
  };

  // Check if index exists to determine initial status
  let indexExists = false;
  try {
    await fs.access(paths.keywordIndex);
    indexExists = true;
  } catch {
    // no index on disk
  }

  const indexState: IndexState = {
    status: indexExists ? 'ready' : 'idle'
  };

  const performIndexing = async (incrementalOnly?: boolean): Promise<void> => {
    indexState.status = 'indexing';
    const mode = incrementalOnly ? 'incremental' : 'full';
    console.error(`Indexing (${mode}): ${rootPath}`);

    try {
      let lastLoggedProgress = { phase: '', percentage: -1 };
      const indexer = new CodebaseIndexer({
        rootPath,
        incrementalOnly,
        onProgress: (progress) => {
          const shouldLog =
            progress.phase !== lastLoggedProgress.phase ||
            (progress.percentage % 10 === 0 &&
              progress.percentage !== lastLoggedProgress.percentage);
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
    } catch (error) {
      indexState.status = 'error';
      indexState.error = error instanceof Error ? error.message : String(error);
      console.error('Indexing failed:', indexState.error);
    }
  };

  return { indexState, paths, rootPath, performIndexing };
}

function extractText(result: { content?: Array<{ type: string; text: string }> }): string {
  return result.content?.[0]?.text ?? '';
}

function formatJson(json: string, useJson: boolean): void {
  if (useJson) {
    console.log(json);
    return;
  }
  // Pretty-print already-formatted JSON as-is (it's already readable)
  console.log(json);
}

export async function handleCliCommand(argv: string[]): Promise<void> {
  const command = argv[0] as CliCommand | '--help' | undefined;

  if (!command || command === '--help') {
    printUsage();
    return;
  }

  if (command === 'memory') {
    return handleMemoryCli(argv.slice(1));
  }

  const useJson = argv.includes('--json');

  // Parse flags into a map
  const flags: Record<string, string | boolean> = {};
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') continue;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }

  const ctx = await initToolContext();

  let toolName: string;
  let toolArgs: Record<string, unknown> = {};

  switch (command) {
    case 'search': {
      if (!flags['query']) {
        console.error('Error: --query is required');
        console.error('Usage: codebase-context search --query <text> [--intent <i>] [--limit <n>]');
        process.exit(1);
      }
      toolName = 'search_codebase';
      toolArgs = {
        query: flags['query'],
        ...(flags['intent'] ? { intent: flags['intent'] } : {}),
        ...(flags['limit'] ? { limit: Number(flags['limit']) } : {}),
        ...(flags['lang'] || flags['framework'] || flags['layer']
          ? {
              filters: {
                ...(flags['lang'] ? { language: flags['lang'] } : {}),
                ...(flags['framework'] ? { framework: flags['framework'] } : {}),
                ...(flags['layer'] ? { layer: flags['layer'] } : {})
              }
            }
          : {})
      };
      break;
    }
    case 'metadata': {
      toolName = 'get_codebase_metadata';
      break;
    }
    case 'status': {
      toolName = 'get_indexing_status';
      break;
    }
    case 'reindex': {
      toolName = 'refresh_index';
      toolArgs = {
        ...(flags['incremental'] ? { incrementalOnly: true } : {}),
        ...(flags['reason'] ? { reason: flags['reason'] } : {})
      };
      // For CLI, reindex must be awaited (fire-and-forget won't work in a process that exits)
      await ctx.performIndexing(Boolean(flags['incremental']));
      const statusResult = await dispatchTool('get_indexing_status', {}, ctx);
      formatJson(extractText(statusResult), useJson);
      return;
    }
    case 'style-guide': {
      toolName = 'get_style_guide';
      toolArgs = {
        ...(flags['query'] ? { query: flags['query'] } : {}),
        ...(flags['category'] ? { category: flags['category'] } : {})
      };
      break;
    }
    case 'patterns': {
      toolName = 'get_team_patterns';
      toolArgs = {
        ...(flags['category'] ? { category: flags['category'] } : {})
      };
      break;
    }
    case 'refs': {
      if (!flags['symbol']) {
        console.error('Error: --symbol is required');
        console.error('Usage: codebase-context refs --symbol <name> [--limit <n>]');
        process.exit(1);
      }
      toolName = 'get_symbol_references';
      toolArgs = {
        symbol: flags['symbol'],
        ...(flags['limit'] ? { limit: Number(flags['limit']) } : {})
      };
      break;
    }
    case 'cycles': {
      toolName = 'detect_circular_dependencies';
      toolArgs = {
        ...(flags['scope'] ? { scope: flags['scope'] } : {})
      };
      break;
    }
    default: {
      console.error(`Unknown command: ${command}`);
      console.error('');
      printUsage();
      process.exit(1);
    }
  }

  try {
    const result = await dispatchTool(toolName, toolArgs, ctx);
    if (result.isError) {
      console.error(extractText(result));
      process.exit(1);
    }
    formatJson(extractText(result), useJson);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export async function handleMemoryCli(args: string[]): Promise<void> {
  // Resolve project root: use CODEBASE_ROOT env or cwd (argv[2] is "memory", not a path)
  const cliRoot = process.env.CODEBASE_ROOT || process.cwd();
  const memoryPath = path.join(cliRoot, CODEBASE_CONTEXT_DIRNAME, MEMORY_FILENAME);
  const subcommand = args[0]; // list | add | remove

  if (subcommand === 'list') {
    const memories = await readMemoriesFile(memoryPath);
    const opts: { category?: MemoryCategory; type?: MemoryType; query?: string } = {};

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--category' && args[i + 1]) opts.category = args[++i] as MemoryCategory;
      else if (args[i] === '--type' && args[i + 1]) opts.type = args[++i] as MemoryType;
      else if (args[i] === '--query' && args[i + 1]) opts.query = args[++i];
      else if (args[i] === '--json') {
        // handled below
      }
    }

    const filtered = filterMemories(memories, opts);
    const enriched = withConfidence(filtered);
    const useJson = args.includes('--json');

    if (useJson) {
      console.log(JSON.stringify(enriched, null, 2));
    } else {
      if (enriched.length === 0) {
        console.log('No memories found.');
      } else {
        for (const m of enriched) {
          const staleTag = m.stale ? ' [STALE]' : '';
          console.log(`[${m.id}] ${m.type}/${m.category}: ${m.memory}${staleTag}`);
          console.log(`  Reason: ${m.reason}`);
          console.log(`  Date: ${m.date} | Confidence: ${m.effectiveConfidence}`);
          console.log('');
        }
        console.log(`${enriched.length} memor${enriched.length === 1 ? 'y' : 'ies'} total.`);
      }
    }
  } else if (subcommand === 'add') {
    let type: MemoryType = 'decision';
    let category: MemoryCategory | undefined;
    let memory: string | undefined;
    let reason: string | undefined;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--type' && args[i + 1]) type = args[++i] as MemoryType;
      else if (args[i] === '--category' && args[i + 1]) category = args[++i] as MemoryCategory;
      else if (args[i] === '--memory' && args[i + 1]) memory = args[++i];
      else if (args[i] === '--reason' && args[i + 1]) reason = args[++i];
    }

    if (!category || !memory || !reason) {
      console.error(
        'Usage: codebase-context memory add --type <type> --category <category> --memory <text> --reason <text>'
      );
      console.error('Required: --category, --memory, --reason');
      process.exit(1);
    }

    const crypto = await import('crypto');
    const hashContent = `${type}:${category}:${memory}:${reason}`;
    const hash = crypto.createHash('sha256').update(hashContent).digest('hex');
    const id = hash.substring(0, 12);

    const newMemory: Memory = {
      id,
      type,
      category,
      memory,
      reason,
      date: new Date().toISOString()
    };
    const result = await appendMemoryFile(memoryPath, newMemory);

    if (result.status === 'duplicate') {
      console.log(`Already exists: [${id}] ${memory}`);
    } else {
      console.log(`Added: [${id}] ${memory}`);
    }
  } else if (subcommand === 'remove') {
    const id = args[1];
    if (!id) {
      console.error('Usage: codebase-context memory remove <id>');
      process.exit(1);
    }

    const result = await removeMemory(memoryPath, id);
    if (result.status === 'not_found') {
      console.error(`Memory not found: ${id}`);
      process.exit(1);
    } else {
      console.log(`Removed: ${id}`);
    }
  } else {
    console.error('Usage: codebase-context memory <list|add|remove>');
    console.error('');
    console.error('  list [--category <cat>] [--type <type>] [--query <text>] [--json]');
    console.error('  add --type <type> --category <category> --memory <text> --reason <text>');
    console.error('  remove <id>');
    process.exit(1);
  }
}
