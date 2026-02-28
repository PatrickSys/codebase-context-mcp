import { promises as fs } from 'fs';
import path from 'path';
import { CODEBASE_CONTEXT_DIRNAME, KEYWORD_INDEX_FILENAME } from '../constants/codebase-context.js';
import { IndexCorruptedError } from '../errors/index.js';
import type { UsageLocation } from '../types/index.js';
import { detectLanguage } from '../utils/language-detection.js';
import { findIdentifierOccurrences } from '../utils/tree-sitter.js';

interface IndexedChunk {
  content?: unknown;
  startLine?: unknown;
  relativePath?: unknown;
  filePath?: unknown;
}

export interface SymbolUsage extends UsageLocation {
  preview: string;
}

interface SymbolReferencesSuccess {
  status: 'success';
  symbol: string;
  usageCount: number;
  usages: SymbolUsage[];
  confidence: 'syntactic';
  isComplete: boolean;
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
    return chunk.relativePath.replace(/\\/g, '/');
  }

  if (typeof chunk.filePath === 'string' && chunk.filePath.trim()) {
    const relativePath = path.relative(rootPath, chunk.filePath);
    if (!relativePath || relativePath.startsWith('..')) {
      return path.basename(chunk.filePath);
    }
    return relativePath.replace(/\\/g, '/');
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

function buildPreviewFromFileLines(lines: string[], line: number): string {
  const start = Math.max(0, line - 2);
  const end = Math.min(lines.length, line + 1);
  return lines.slice(start, end).join('\n').trim();
}

function resolveAbsoluteChunkPath(rootPath: string, chunk: IndexedChunk): string | null {
  const resolvedRoot = path.resolve(rootPath);
  const isWithinRoot = (candidate: string): boolean => {
    const resolvedCandidate = path.resolve(candidate);
    const relative = path.relative(resolvedRoot, resolvedCandidate);
    return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
  };

  if (typeof chunk.filePath === 'string' && chunk.filePath.trim()) {
    const raw = chunk.filePath.trim();
    if (path.isAbsolute(raw)) {
      return isWithinRoot(raw) ? raw : null;
    }
    const resolved = path.resolve(resolvedRoot, raw);
    return isWithinRoot(resolved) ? resolved : null;
  }

  if (typeof chunk.relativePath === 'string' && chunk.relativePath.trim()) {
    const resolved = path.resolve(resolvedRoot, chunk.relativePath.trim());
    return isWithinRoot(resolved) ? resolved : null;
  }

  return null;
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function findSymbolReferences(
  rootPath: string,
  symbol: string,
  limit = 10
): Promise<SymbolReferencesResult> {
  const normalizedSymbol = symbol.trim();
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;

  if (!normalizedSymbol) {
    return {
      status: 'error',
      message: 'Symbol is required'
    };
  }

  const indexPath = path.join(rootPath, CODEBASE_CONTEXT_DIRNAME, KEYWORD_INDEX_FILENAME);

  let chunksRaw: unknown;
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    chunksRaw = JSON.parse(content);
  } catch (error) {
    throw new IndexCorruptedError(
      `Keyword index missing or unreadable (rebuild required): ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (Array.isArray(chunksRaw)) {
    throw new IndexCorruptedError(
      'Legacy keyword index format detected (missing header). Rebuild required.'
    );
  }

  const chunks =
    chunksRaw !== null &&
    typeof chunksRaw === 'object' &&
    'chunks' in chunksRaw &&
    Array.isArray(chunksRaw.chunks)
      ? (chunksRaw.chunks as unknown[])
      : null;

  if (!chunks) {
    throw new IndexCorruptedError('Keyword index corrupted: expected { header, chunks }');
  }

  const usages: SymbolUsage[] = [];
  let usageCount = 0;

  const escapedSymbol = escapeRegex(normalizedSymbol);
  const prefilter = new RegExp(`\\b${escapedSymbol}\\b`);
  const matcher = new RegExp(`\\b${escapedSymbol}\\b`, 'g');

  // Prefilter candidate files from the keyword index. We do not trust chunk contents for
  // exact reference counting when Tree-sitter is available; chunks only guide which files to scan.
  const chunksByFile = new Map<
    string,
    { relPath: string; absPath: string | null; chunks: IndexedChunk[] }
  >();

  for (const chunkRaw of chunks) {
    const chunk = chunkRaw as IndexedChunk;
    if (typeof chunk.content !== 'string') continue;
    if (!prefilter.test(chunk.content)) continue;

    const relPath = getUsageFile(rootPath, chunk);
    const absPath = resolveAbsoluteChunkPath(rootPath, chunk);

    const entry = chunksByFile.get(relPath);
    if (entry) {
      entry.chunks.push(chunk);
      // Prefer a real absolute path when available
      if (!entry.absPath && absPath) {
        entry.absPath = absPath;
      }
    } else {
      chunksByFile.set(relPath, { relPath, absPath, chunks: [chunk] });
    }
  }

  for (const entry of chunksByFile.values()) {
    const relPath = entry.relPath;
    const absPath = entry.absPath;

    // Preferred: Tree-sitter identifier walk on the real file content.
    if (absPath && (await fileExists(absPath))) {
      try {
        const raw = await fs.readFile(absPath, 'utf-8');
        const content = raw.replace(/\r\n/g, '\n');
        const language = detectLanguage(absPath);
        const occurrences = await findIdentifierOccurrences(content, language, normalizedSymbol);

        if (occurrences) {
          usageCount += occurrences.length;

          if (usages.length < normalizedLimit && occurrences.length > 0) {
            const lines = content.split('\n');
            for (const occ of occurrences) {
              if (usages.length >= normalizedLimit) break;
              usages.push({
                file: relPath,
                line: occ.line,
                preview: buildPreviewFromFileLines(lines, occ.line)
              });
            }
          }

          continue;
        }
      } catch {
        // Fall through to chunk-regex fallback (missing grammar, parse failure, etc.)
      }
    }

    // Fallback: regex scan inside the matched chunks (legacy behavior).
    for (const chunk of entry.chunks) {
      if (typeof chunk.content !== 'string') continue;

      const chunkContent = chunk.content;
      const startLine = typeof chunk.startLine === 'number' ? chunk.startLine : 1;
      matcher.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = matcher.exec(chunkContent)) !== null) {
        usageCount += 1;

        if (usages.length >= normalizedLimit) {
          continue;
        }

        const prefix = chunkContent.slice(0, match.index);
        const lineOffset = prefix.split('\n').length - 1;

        usages.push({
          file: relPath,
          line: startLine + lineOffset,
          preview: buildPreview(chunkContent, lineOffset)
        });
      }
    }
  }

  return {
    status: 'success',
    symbol: normalizedSymbol,
    usageCount,
    usages,
    confidence: 'syntactic',
    isComplete: usageCount < normalizedLimit
  };
}
