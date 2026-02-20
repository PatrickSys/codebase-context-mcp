import { promises as fs } from 'fs';
import path from 'path';
import { CODEBASE_CONTEXT_DIRNAME, KEYWORD_INDEX_FILENAME } from '../constants/codebase-context.js';

interface IndexedChunk {
  content?: unknown;
  startLine?: unknown;
  relativePath?: unknown;
  filePath?: unknown;
}

export interface SymbolUsage {
  file: string;
  line: number;
  preview: string;
}

interface SymbolReferencesSuccess {
  status: 'success';
  symbol: string;
  usageCount: number;
  usages: SymbolUsage[];
}

interface SymbolReferencesError {
  status: 'error';
  message: string;
}

export type SymbolReferencesResult = SymbolReferencesSuccess | SymbolReferencesError;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getUsageFile(rootPath: string, chunk: IndexedChunk): string {
  if (typeof chunk.relativePath === 'string' && chunk.relativePath.trim()) {
    return chunk.relativePath;
  }

  if (typeof chunk.filePath === 'string' && chunk.filePath.trim()) {
    const relativePath = path.relative(rootPath, chunk.filePath);
    if (!relativePath || relativePath.startsWith('..')) {
      return path.basename(chunk.filePath);
    }
    return relativePath;
  }

  return 'unknown';
}

function buildPreview(content: string, lineOffset: number): string {
  const lines = content.split('\n');
  const start = Math.max(0, lineOffset - 1);
  const end = Math.min(lines.length, lineOffset + 2);
  const previewLines = lines.slice(start, end);
  return previewLines.join('\n').trim();
}

export async function findSymbolReferences(
  rootPath: string,
  symbol: string,
  limit = 10
): Promise<SymbolReferencesResult> {
  const indexPath = path.join(rootPath, CODEBASE_CONTEXT_DIRNAME, KEYWORD_INDEX_FILENAME);

  let chunksRaw: unknown;
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    chunksRaw = JSON.parse(content);
  } catch {
    return {
      status: 'error',
      message: 'Run indexing first'
    };
  }

  if (!Array.isArray(chunksRaw)) {
    return {
      status: 'error',
      message: 'Run indexing first'
    };
  }

  const usages: SymbolUsage[] = [];
  let usageCount = 0;

  const escapedSymbol = escapeRegex(symbol);
  const matcher = new RegExp(`\\b${escapedSymbol}\\b`, 'g');

  for (const chunkRaw of chunksRaw) {
    const chunk = chunkRaw as IndexedChunk;
    if (typeof chunk.content !== 'string') {
      continue;
    }

    const chunkContent = chunk.content;
    const startLine = typeof chunk.startLine === 'number' ? chunk.startLine : 1;
    matcher.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = matcher.exec(chunkContent)) !== null) {
      usageCount += 1;

      if (usages.length >= limit) {
        continue;
      }

      const prefix = chunkContent.slice(0, match.index);
      const lineOffset = prefix.split('\n').length - 1;

      usages.push({
        file: getUsageFile(rootPath, chunk),
        line: startLine + lineOffset,
        preview: buildPreview(chunkContent, lineOffset)
      });
    }
  }

  return {
    status: 'success',
    symbol,
    usageCount,
    usages
  };
}
