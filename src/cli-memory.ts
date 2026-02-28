/**
 * CLI handler for memory subcommands: list, add, remove.
 */

import path from 'path';
import type { Memory, MemoryCategory, MemoryType } from './types/index.js';
import {
  CODEBASE_CONTEXT_DIRNAME,
  MEMORY_FILENAME
} from './constants/codebase-context.js';
import {
  appendMemoryFile,
  readMemoriesFile,
  removeMemory,
  filterMemories,
  withConfidence
} from './memory/store.js';

const MEMORY_CATEGORIES = [
  'tooling',
  'architecture',
  'testing',
  'dependencies',
  'conventions'
] as const satisfies readonly MemoryCategory[];

const MEMORY_TYPES = ['convention', 'decision', 'gotcha', 'failure'] as const satisfies readonly MemoryType[];

const MEMORY_CATEGORY_SET: ReadonlySet<string> = new Set(MEMORY_CATEGORIES);
function isMemoryCategory(value: string): value is MemoryCategory {
  return MEMORY_CATEGORY_SET.has(value);
}

const MEMORY_TYPE_SET: ReadonlySet<string> = new Set(MEMORY_TYPES);
function isMemoryType(value: string): value is MemoryType {
  return MEMORY_TYPE_SET.has(value);
}

function exitWithError(message: string): never {
  console.error(message);
  process.exit(1);
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
      if (args[i] === '--category') {
        const value = args[i + 1];
        if (!value || value.startsWith('--')) {
          exitWithError(
            `Error: --category requires a value. Allowed: ${MEMORY_CATEGORIES.join(', ')}`
          );
        }
        if (!isMemoryCategory(value)) {
          exitWithError(
            `Error: invalid --category "${value}". Allowed: ${MEMORY_CATEGORIES.join(', ')}`
          );
        }
        opts.category = value;
        i++;
      } else if (args[i] === '--type') {
        const value = args[i + 1];
        if (!value || value.startsWith('--')) {
          exitWithError(`Error: --type requires a value. Allowed: ${MEMORY_TYPES.join(', ')}`);
        }
        if (!isMemoryType(value)) {
          exitWithError(`Error: invalid --type "${value}". Allowed: ${MEMORY_TYPES.join(', ')}`);
        }
        opts.type = value;
        i++;
      } else if (args[i] === '--query') {
        const value = args[i + 1];
        if (!value || value.startsWith('--')) {
          exitWithError('Error: --query requires a value.');
        }
        opts.query = value;
        i++;
      } else if (args[i] === '--json') {
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
      if (args[i] === '--type') {
        const value = args[i + 1];
        if (!value || value.startsWith('--')) {
          exitWithError(`Error: --type requires a value. Allowed: ${MEMORY_TYPES.join(', ')}`);
        }
        if (!isMemoryType(value)) {
          exitWithError(`Error: invalid --type "${value}". Allowed: ${MEMORY_TYPES.join(', ')}`);
        }
        type = value;
        i++;
      } else if (args[i] === '--category') {
        const value = args[i + 1];
        if (!value || value.startsWith('--')) {
          exitWithError(
            `Error: --category requires a value. Allowed: ${MEMORY_CATEGORIES.join(', ')}`
          );
        }
        if (!isMemoryCategory(value)) {
          exitWithError(
            `Error: invalid --category "${value}". Allowed: ${MEMORY_CATEGORIES.join(', ')}`
          );
        }
        category = value;
        i++;
      } else if (args[i] === '--memory') {
        const value = args[i + 1];
        if (!value || value.startsWith('--')) {
          exitWithError('Error: --memory requires a value.');
        }
        memory = value;
        i++;
      } else if (args[i] === '--reason') {
        const value = args[i + 1];
        if (!value || value.startsWith('--')) {
          exitWithError('Error: --reason requires a value.');
        }
        reason = value;
        i++;
      }
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
