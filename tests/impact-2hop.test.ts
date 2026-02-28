import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { CodebaseIndexer } from '../src/core/indexer.js';
import { dispatchTool } from '../src/tools/index.js';
import type { ToolContext } from '../src/tools/types.js';
import {
  CODEBASE_CONTEXT_DIRNAME,
  INTELLIGENCE_FILENAME,
  KEYWORD_INDEX_FILENAME,
  VECTOR_DB_DIRNAME,
  MEMORY_FILENAME
} from '../src/constants/codebase-context.js';

describe('Impact candidates (2-hop)', () => {
  let tempRoot: string | null = null;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'impact-2hop-'));
    const srcDir = path.join(tempRoot, 'src');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'package.json'), JSON.stringify({ name: 'impact-2hop' }));

    await fs.writeFile(
      path.join(srcDir, 'c.ts'),
      `export function cFn() { return 'UNIQUE_TOKEN_123'; }\n`
    );
    await fs.writeFile(path.join(srcDir, 'b.ts'), `import { cFn } from './c';\nexport const b = cFn();\n`);
    await fs.writeFile(path.join(srcDir, 'a.ts'), `import { b } from './b';\nexport const a = b;\n`);

    const indexer = new CodebaseIndexer({
      rootPath: tempRoot,
      config: { skipEmbedding: true }
    });
    await indexer.index();
  });

  afterEach(async () => {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it('includes hop 1 and hop 2 candidates in preflight impact.details', async () => {
    if (!tempRoot) throw new Error('tempRoot not initialized');

    const rootPath = tempRoot;
    const paths = {
      baseDir: path.join(rootPath, CODEBASE_CONTEXT_DIRNAME),
      memory: path.join(rootPath, CODEBASE_CONTEXT_DIRNAME, MEMORY_FILENAME),
      intelligence: path.join(rootPath, CODEBASE_CONTEXT_DIRNAME, INTELLIGENCE_FILENAME),
      keywordIndex: path.join(rootPath, CODEBASE_CONTEXT_DIRNAME, KEYWORD_INDEX_FILENAME),
      vectorDb: path.join(rootPath, CODEBASE_CONTEXT_DIRNAME, VECTOR_DB_DIRNAME)
    };

    const ctx: ToolContext = {
      indexState: { status: 'ready' },
      paths,
      rootPath,
      performIndexing: () => {}
    };

    const resp = await dispatchTool(
      'search_codebase',
      { query: 'UNIQUE_TOKEN_123', intent: 'edit', includeSnippets: false },
      ctx
    );

    const text = resp.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text) as { preflight?: { impact?: { details?: Array<{ file: string; hop: 1 | 2 }> } } };
    const details = parsed.preflight?.impact?.details ?? [];

    expect(details.some((d) => d.file.endsWith('src/b.ts') && d.hop === 1)).toBe(true);
    expect(details.some((d) => d.file.endsWith('src/a.ts') && d.hop === 2)).toBe(true);
  });
});

