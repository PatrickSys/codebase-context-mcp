/**
 * CLI subcommands for codebase-context.
 * Memory list/add/remove — vendor-neutral access without any AI agent.
 */

import path from 'path';
import type { Memory, MemoryCategory, MemoryType } from './types/index.js';
import { CODEBASE_CONTEXT_DIRNAME, MEMORY_FILENAME } from './constants/codebase-context.js';
import {
  appendMemoryFile,
  readMemoriesFile,
  removeMemory,
  filterMemories,
  withConfidence
} from './memory/store.js';

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
