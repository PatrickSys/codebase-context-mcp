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
import type {
  IndexState,
  SearchResponse,
  SearchQuality,
  SearchResultItem,
  PatternResponse,
  PatternCategory,
  PatternEntry,
  GoldenFile,
  PatternConflict,
  RefsResponse,
  RefsUsage,
  DecisionCard
} from './tools/types.js';
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

function formatJson(
  json: string,
  useJson: boolean,
  command?: string,
  rootPath?: string,
  query?: string,
  intent?: string
): void {
  if (useJson) {
    console.log(json);
    return;
  }

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    console.log(json);
    return;
  }

  switch (command) {
    case 'patterns':
      formatPatterns(data as PatternResponse);
      break;
    case 'search':
      formatSearch(data as SearchResponse, rootPath ?? '', query, intent);
      break;
    case 'refs':
      formatRefs(data as RefsResponse, rootPath ?? '');
      break;
    default:
      console.log(JSON.stringify(data, null, 2));
  }
}

function shortPath(filePath: string, rootPath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const normalizedRoot = rootPath.replace(/\\/g, '/');
  if (normalized.startsWith(normalizedRoot)) {
    return normalized.slice(normalizedRoot.length).replace(/^\//, '');
  }
  // Also strip common Repos/ prefix patterns
  const reposIdx = normalized.indexOf('/Repos/');
  if (reposIdx >= 0) {
    const afterRepos = normalized.slice(reposIdx + 7);
    const slashIdx = afterRepos.indexOf('/');
    return slashIdx >= 0 ? afterRepos.slice(slashIdx + 1) : afterRepos;
  }
  return path.basename(filePath);
}

function formatTrend(trend?: string): string {
  if (trend === 'Rising') return 'rising';
  if (trend === 'Declining') return 'declining';
  return '';
}

function formatType(type?: string): string {
  if (!type) return '';
  // "interceptor:core" → "interceptor (core)"
  const [compType, layer] = type.split(':');
  return layer ? `${compType} (${layer})` : compType;
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function drawBox(title: string, lines: string[], width: number = 60): string[] {
  const output: string[] = [];
  const inner = width - 4; // 2 for "| " + 2 for " |"
  const dashes = '\u2500';
  const titlePart = `\u250c\u2500 ${title} `;
  const remaining = Math.max(0, width - titlePart.length - 1);
  output.push(titlePart + dashes.repeat(remaining) + '\u2510');
  for (const line of lines) {
    const padded =
      line.length <= inner ? line + ' '.repeat(inner - line.length) : line.slice(0, inner);
    output.push(`\u2502 ${padded} \u2502`);
  }
  output.push('\u2514' + dashes.repeat(width - 2) + '\u2518');
  return output;
}

function formatPatterns(data: PatternResponse): void {
  const { patterns, goldenFiles, memories, conflicts } = data;
  const lines: string[] = [];

  if (patterns) {
    for (const [category, catData] of Object.entries(patterns)) {
      const label = category
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
      lines.push('');
      lines.push(label.toUpperCase());

      const primary: PatternEntry = catData.primary;
      if (primary) {
        const name = padRight(primary.name ?? '', 28);
        const freq = padRight(primary.frequency ?? '', 8);
        const trend = formatTrend(primary.trend);
        lines.push(`  ${name} ${freq}${trend ? ` ${trend}` : ''}`);
      }

      const alsoDetected: PatternEntry[] | undefined = catData.alsoDetected;
      if (alsoDetected) {
        for (const alt of alsoDetected) {
          const name = padRight(alt.name ?? '', 28);
          const freq = padRight(alt.frequency ?? '', 8);
          const trend = formatTrend(alt.trend);
          lines.push(`  ${name} ${freq}${trend ? ` ${trend}` : ''}`);
        }
      }
    }
  }

  if (goldenFiles && goldenFiles.length > 0) {
    lines.push('');
    lines.push('GOLDEN FILES');
    for (const gf of goldenFiles.slice(0, 5)) {
      const file = padRight(gf.file ?? '', 44);
      lines.push(`  ${file} ${gf.score} patterns`);
    }
  }

  if (conflicts && conflicts.length > 0) {
    lines.push('');
    lines.push('CONFLICTS');
    for (const c of conflicts) {
      lines.push(
        `  ${c.category}: ${c.primary?.name} (${c.primary?.adoption}) vs ${c.alternative?.name} (${c.alternative?.adoption})`
      );
    }
  }

  if (memories && memories.length > 0) {
    lines.push('');
    lines.push(`MEMORIES (from git)`);
    for (const m of memories.slice(0, 5)) {
      lines.push(`  [${m.type}] ${m.memory}`);
    }
  }

  lines.push('');

  const boxLines = drawBox('Team Patterns', lines);
  console.log('');
  for (const l of boxLines) {
    console.log(l);
  }
  console.log('');
}

function formatSearch(
  data: SearchResponse,
  rootPath: string,
  query?: string,
  intent?: string
): void {
  const { searchQuality: quality, preflight, results, relatedMemories: memories } = data;

  // Build box lines for preflight section
  const boxLines: string[] = [];

  if (quality) {
    const status = quality.status === 'ok' ? 'ok' : 'low confidence';
    const conf = quality.confidence ?? '';
    boxLines.push(`Quality: ${status} (${conf})`);
    if (quality.hint) {
      boxLines.push(`Hint: ${quality.hint}`);
    }
  }

  if (preflight) {
    const readyLabel = preflight.ready ? 'YES' : 'NO';
    boxLines.push(`Ready to edit: ${readyLabel}`);

    if (preflight.nextAction) {
      boxLines.push(`Next: ${preflight.nextAction}`);
    }

    const patterns = preflight.patterns;
    if (patterns) {
      if (patterns.do && patterns.do.length > 0) {
        boxLines.push('');
        boxLines.push('Patterns:');
        for (const p of patterns.do) {
          boxLines.push(`  \u2713 ${p}`);
        }
      }
      if (patterns.avoid && patterns.avoid.length > 0) {
        for (const p of patterns.avoid) {
          boxLines.push(`  \u2717 ${p}`);
        }
      }
    }

    if (preflight.bestExample) {
      boxLines.push('');
      boxLines.push(`Best example: ${shortPath(preflight.bestExample, rootPath)}`);
    }

    const impact = preflight.impact;
    if (impact?.coverage) {
      boxLines.push(`Callers: ${impact.coverage}`);
    }

    const whatWouldHelp = preflight.whatWouldHelp;
    if (whatWouldHelp && whatWouldHelp.length > 0) {
      boxLines.push('');
      for (const h of whatWouldHelp) {
        boxLines.push(`\u2192 ${h}`);
      }
    }
  }

  // Build box title
  const titleParts: string[] = [];
  if (query) titleParts.push(`"${query}"`);
  if (intent) titleParts.push(`intent: ${intent}`);
  const boxTitle =
    titleParts.length > 0 ? `Search: ${titleParts.join(' \u2500\u2500\u2500 ')}` : 'Search';

  // Print box if there is preflight content
  console.log('');
  if (boxLines.length > 0) {
    const boxOut = drawBox(boxTitle, boxLines, 62);
    for (const l of boxOut) {
      console.log(l);
    }
    console.log('');
  }

  // Results
  if (results && results.length > 0) {
    for (let i = 0; i < results.length; i++) {
      const r: SearchResultItem = results[i];
      const file = shortPath(r.file ?? '', rootPath);
      const score = Number(r.score ?? 0).toFixed(2);
      const typePart = formatType(r.type);
      const trendPart = formatTrend(r.trend);

      const metaParts = [`score: ${score}`];
      if (typePart) metaParts.push(typePart);
      if (trendPart) metaParts.push(trendPart);

      console.log(`${i + 1}.  ${file}`);
      console.log(`    ${metaParts.join(' | ')}`);

      const summary = r.summary ?? '';
      if (summary) {
        const short = summary.length > 80 ? summary.slice(0, 77) + '...' : summary;
        console.log(`    ${short}`);
      }

      const hints = r.hints;
      if (hints?.callers && hints.callers.length > 0) {
        const shortCallers = hints.callers.slice(0, 3).map((c) => shortPath(c, rootPath));
        console.log(`    callers: ${shortCallers.join(', ')}`);
      }
      console.log('');
    }
  }

  // Related memories
  if (memories && memories.length > 0) {
    console.log('Memories:');
    for (const m of memories) {
      console.log(`  ${m}`);
    }
    console.log('');
  }
}

function formatRefs(data: RefsResponse, rootPath: string): void {
  const { symbol, usageCount: count, confidence, usages } = data;

  const lines: string[] = [];
  lines.push('');
  lines.push(String(symbol));

  if (usages && usages.length > 0) {
    lines.push('\u2502');
    for (let i = 0; i < usages.length; i++) {
      const u: RefsUsage = usages[i];
      const isLast = i === usages.length - 1;
      const branch = isLast ? '\u2514\u2500' : '\u251c\u2500';
      const file = shortPath(u.file ?? '', rootPath);
      lines.push(`${branch} ${file}:${u.line}`);

      const preview = u.preview ?? '';
      if (preview) {
        const firstLine = preview.split('\n')[0].trim();
        if (firstLine) {
          const indent = isLast ? '   ' : '\u2502  ';
          lines.push(`${indent} ${firstLine}`);
        }
      }

      if (!isLast) {
        lines.push('\u2502');
      }
    }
  }

  lines.push('');

  const boxTitle = `${symbol} \u2500\u2500\u2500 ${count} references \u2500\u2500\u2500 ${confidence}`;
  const boxOut = drawBox(boxTitle, lines, 62);
  console.log('');
  for (const l of boxOut) {
    console.log(l);
  }
  console.log('');
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
    formatJson(
      extractText(result),
      useJson,
      command,
      ctx.rootPath,
      flags['query'] as string | undefined,
      flags['intent'] as string | undefined
    );
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
