/**
 * AST-Aligned Chunking Engine
 *
 * Produces symbol-bounded chunks from Tree-sitter output instead of
 * arbitrary line-sliced chunks. Each function/method/class becomes its
 * own chunk, with size bounds enforced via merging (tiny) and splitting
 * (oversized) at safe structural boundaries.
 */

import { v4 as uuidv4 } from 'uuid';
import type { TreeSitterSymbol } from './tree-sitter.js';
import type { CodeChunk, ChunkMetadata } from '../types/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SymbolNode {
  symbol: TreeSitterSymbol;
  children: SymbolNode[];
  parent: SymbolNode | null;
}

export interface ASTChunkOptions {
  minChunkLines: number;
  maxChunkLines: number;
  filePath: string;
  language: string;
  framework?: string;
  componentType?: string;
}

export const DEFAULT_AST_CHUNK_OPTIONS = {
  minChunkLines: 10,
  maxChunkLines: 150
} as const;

// ---------------------------------------------------------------------------
// 1. buildSymbolTree
// ---------------------------------------------------------------------------

/**
 * Build a parent/child tree from a flat list of Tree-sitter symbols.
 *
 * A symbol B is a child of A when A fully contains B (A.startLine <= B.startLine
 * AND A.endLine >= B.endLine) and A is the *smallest* such container.
 */
export function buildSymbolTree(symbols: TreeSitterSymbol[]): SymbolNode[] {
  // Sort: startLine ASC, then span DESC (largest first for same start)
  const sorted = [...symbols].sort((a, b) => {
    if (a.startLine !== b.startLine) return a.startLine - b.startLine;
    return b.endLine - b.startLine - (a.endLine - a.startLine);
  });

  const nodes: SymbolNode[] = sorted.map((s) => ({ symbol: s, children: [], parent: null }));

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    let bestParent: SymbolNode | null = null;
    let bestSpan = Infinity;

    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const candidate = nodes[j];
      const cs = candidate.symbol;
      const ns = node.symbol;

      // candidate must fully contain node (and not be identical range unless different symbol)
      if (
        cs.startLine <= ns.startLine &&
        cs.endLine >= ns.endLine &&
        !(cs.startLine === ns.startLine && cs.endLine === ns.endLine)
      ) {
        const span = cs.endLine - cs.startLine;
        if (span < bestSpan) {
          bestSpan = span;
          bestParent = candidate;
        }
      }
    }

    if (bestParent) {
      node.parent = bestParent;
      bestParent.children.push(node);
    }
  }

  return nodes.filter((n) => n.parent === null);
}

// ---------------------------------------------------------------------------
// 2. generateASTChunks
// ---------------------------------------------------------------------------

/**
 * Convert Tree-sitter symbols into non-overlapping, full-coverage CodeChunks.
 *
 * - Leaf symbols → one chunk each (symbolAware)
 * - Container symbols → header + child chunks + footer
 * - Gaps between symbols → filler chunks (not symbolAware)
 */
export function generateASTChunks(
  content: string,
  symbols: TreeSitterSymbol[],
  options: ASTChunkOptions
): CodeChunk[] {
  const lines = content.split('\n');
  const totalLines = lines.length;

  if (symbols.length === 0) {
    // No symbols: entire file is one filler chunk
    return [makeFillerChunk(lines, 1, totalLines, options)];
  }

  const roots = buildSymbolTree(symbols);

  // Sort roots by startLine for ordered processing
  roots.sort((a, b) => a.symbol.startLine - b.symbol.startLine);

  const chunks: CodeChunk[] = [];
  let cursor = 1; // 1-based line cursor

  for (const root of roots) {
    // Gap before this root
    if (root.symbol.startLine > cursor) {
      chunks.push(makeFillerChunk(lines, cursor, root.symbol.startLine - 1, options));
    }
    // Process the root symbol (recurse for containers)
    chunks.push(...processNode(root, lines, options, null));
    cursor = root.symbol.endLine + 1;
  }

  // Suffix after last root
  if (cursor <= totalLines) {
    chunks.push(makeFillerChunk(lines, cursor, totalLines, options));
  }

  return chunks;
}

/** Recursively process a SymbolNode into chunks. */
function processNode(
  node: SymbolNode,
  lines: string[],
  options: ASTChunkOptions,
  parentName: string | null
): CodeChunk[] {
  const sym = node.symbol;
  const symbolPath = parentName ? [parentName, sym.name] : [sym.name];

  if (node.children.length === 0) {
    // Leaf symbol → single chunk
    return [makeSymbolChunk(sym, lines, options, symbolPath, parentName)];
  }

  // Container symbol — split into header, children, footer
  const chunks: CodeChunk[] = [];
  const sortedChildren = [...node.children].sort((a, b) => a.symbol.startLine - b.symbol.startLine);

  // Header: from container start to first child start - 1
  const headerEnd = sortedChildren[0].symbol.startLine - 1;
  if (headerEnd >= sym.startLine) {
    const headerLines = extractLines(lines, sym.startLine, headerEnd);
    const nonBlank = headerLines.filter((l) => l.trim().length > 0).length;
    if (nonBlank > 2) {
      chunks.push(
        makeSymbolChunk(
          {
            ...sym,
            name: `${sym.name}:header`,
            startLine: sym.startLine,
            endLine: headerEnd,
            content: headerLines.join('\n')
          },
          lines,
          options,
          symbolPath,
          parentName,
          true // use provided content
        )
      );
    }
  }

  // Children
  let childCursor = sortedChildren[0].symbol.startLine;
  for (const child of sortedChildren) {
    // Gap between children within container
    if (child.symbol.startLine > childCursor) {
      const gapStart = childCursor;
      const gapEnd = child.symbol.startLine - 1;
      const gapLines = extractLines(lines, gapStart, gapEnd);
      const nonBlank = gapLines.filter((l) => l.trim().length > 0).length;
      if (nonBlank > 0) {
        chunks.push(makeFillerChunk(lines, gapStart, gapEnd, options));
      }
    }
    chunks.push(...processNode(child, lines, options, sym.name));
    childCursor = child.symbol.endLine + 1;
  }

  // Footer: from last child end + 1 to container end
  const lastChildEnd = sortedChildren[sortedChildren.length - 1].symbol.endLine;
  if (lastChildEnd < sym.endLine) {
    const footerStart = lastChildEnd + 1;
    const footerLines = extractLines(lines, footerStart, sym.endLine);
    const nonBlank = footerLines.filter((l) => l.trim().length > 0).length;
    if (nonBlank > 2) {
      chunks.push(
        makeSymbolChunk(
          {
            ...sym,
            name: `${sym.name}:footer`,
            startLine: footerStart,
            endLine: sym.endLine,
            content: footerLines.join('\n')
          },
          lines,
          options,
          symbolPath,
          parentName,
          true
        )
      );
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// 3. mergeSmallSymbolChunks
// ---------------------------------------------------------------------------

/**
 * Merge adjacent symbol-aware chunks that are both below `minLines` AND share
 * the same parentSymbol (or both have no parent).
 */
export function mergeSmallSymbolChunks(chunks: CodeChunk[], minLines: number): CodeChunk[] {
  if (chunks.length <= 1) return chunks;

  const result: CodeChunk[] = [];
  let current = chunks[0];

  for (let i = 1; i < chunks.length; i++) {
    const next = chunks[i];
    const curLines = current.endLine - current.startLine + 1;
    const nextLines = next.endLine - next.startLine + 1;
    const curSymAware = current.metadata?.symbolAware === true;
    const nextSymAware = next.metadata?.symbolAware === true;

    const sameParent =
      (current.metadata?.parentSymbol ?? null) === (next.metadata?.parentSymbol ?? null);

    if (curSymAware && nextSymAware && curLines < minLines && nextLines < minLines && sameParent) {
      // Merge
      const mergedName = [current.metadata?.symbolName || '', next.metadata?.symbolName || '']
        .filter(Boolean)
        .join('+');

      current = {
        ...current,
        content: current.content + '\n' + next.content,
        endLine: next.endLine,
        metadata: {
          ...current.metadata,
          symbolName: mergedName,
          merged: true
        }
      };
    } else {
      result.push(current);
      current = next;
    }
  }

  result.push(current);
  return result;
}

// ---------------------------------------------------------------------------
// 4. splitOversizedChunks
// ---------------------------------------------------------------------------

/**
 * Split any chunk exceeding `maxLines` at safe structural boundaries.
 */
export function splitOversizedChunks(chunks: CodeChunk[], maxLines: number): CodeChunk[] {
  const result: CodeChunk[] = [];
  for (const chunk of chunks) {
    const lineCount = chunk.endLine - chunk.startLine + 1;
    if (lineCount <= maxLines) {
      result.push(chunk);
    } else {
      result.push(...splitChunk(chunk, maxLines));
    }
  }
  return result;
}

function splitChunk(chunk: CodeChunk, maxLines: number): CodeChunk[] {
  const chunkLines = chunk.content.split('\n');
  const lineCount = chunkLines.length;

  if (lineCount <= maxLines) return [chunk];

  // Find safe split point near midpoint
  const mid = Math.floor(lineCount / 2);
  const splitIdx = findSafeSplitPoint(chunkLines, mid);

  const firstContent = chunkLines.slice(0, splitIdx).join('\n');
  const secondContent = chunkLines.slice(splitIdx).join('\n');

  const baseName = chunk.metadata?.symbolName || 'chunk';
  // Strip existing suffix like ":1" before adding new ones
  const cleanName = baseName.replace(/:\d+$/, '');

  const firstChunk: CodeChunk = {
    ...chunk,
    id: uuidv4(),
    content: firstContent,
    endLine: chunk.startLine + splitIdx - 1,
    metadata: {
      ...chunk.metadata,
      symbolName: `${cleanName}:1`
    }
  };

  const secondChunk: CodeChunk = {
    ...chunk,
    id: uuidv4(),
    content: secondContent,
    startLine: chunk.startLine + splitIdx,
    metadata: {
      ...chunk.metadata,
      symbolName: `${cleanName}:2`
    }
  };

  // Recursively split if still oversized
  const result: CodeChunk[] = [];
  result.push(...splitOversizedChunks([firstChunk], maxLines));
  result.push(...splitOversizedChunks([secondChunk], maxLines));

  // Renumber after recursive splits
  if (result.length > 2) {
    for (let i = 0; i < result.length; i++) {
      result[i] = {
        ...result[i],
        metadata: {
          ...result[i].metadata,
          symbolName: `${cleanName}:${i + 1}`
        }
      };
    }
  }

  return result;
}

/**
 * Find a safe split point near `targetIdx`:
 * - Blank line
 * - Comment boundary
 * - Closing brace at same or lesser indent
 */
function findSafeSplitPoint(lines: string[], targetIdx: number): number {
  const windowSize = Math.min(20, Math.floor(lines.length / 4));

  let bestIdx = targetIdx;
  let bestDistance = Infinity;

  // Search in a window around the midpoint
  const lo = Math.max(1, targetIdx - windowSize);
  const hi = Math.min(lines.length - 1, targetIdx + windowSize);

  for (let i = lo; i <= hi; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isSafe =
      trimmed === '' || /^\s*(\/\/|#|\/\*|\*\/)/.test(line) || trimmed === '}' || trimmed === '};';

    if (isSafe) {
      const dist = Math.abs(i - targetIdx);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestIdx = i + 1; // split *after* this line
      }
    }
  }

  // If no safe point found, hard split at target
  if (bestDistance === Infinity) {
    bestIdx = targetIdx;
  }

  return bestIdx;
}

// ---------------------------------------------------------------------------
// 5. createASTAlignedChunks (public entry point)
// ---------------------------------------------------------------------------

/**
 * Main public API: generate AST-aligned chunks from content + symbols,
 * then merge tiny chunks and split oversized ones.
 */
export function createASTAlignedChunks(
  content: string,
  symbols: TreeSitterSymbol[],
  options: ASTChunkOptions
): CodeChunk[] {
  const raw = generateASTChunks(content, symbols, options);
  const merged = mergeSmallSymbolChunks(raw, options.minChunkLines);
  const final = splitOversizedChunks(merged, options.maxChunkLines);
  return final;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractLines(lines: string[], startLine: number, endLine: number): string[] {
  // startLine and endLine are 1-based inclusive
  return lines.slice(startLine - 1, endLine);
}

function makeFillerChunk(
  lines: string[],
  startLine: number,
  endLine: number,
  options: ASTChunkOptions
): CodeChunk {
  const chunkContent = extractLines(lines, startLine, endLine).join('\n');
  return {
    id: uuidv4(),
    content: chunkContent,
    filePath: options.filePath,
    relativePath: options.filePath,
    startLine,
    endLine,
    language: options.language,
    framework: options.framework,
    componentType: options.componentType,
    dependencies: [],
    imports: [],
    exports: [],
    tags: [],
    metadata: {
      chunkStrategy: 'ast-aligned'
    } as ChunkMetadata
  };
}

function makeSymbolChunk(
  sym: TreeSitterSymbol,
  lines: string[],
  options: ASTChunkOptions,
  symbolPath: string[],
  parentName: string | null,
  useProvidedContent = false
): CodeChunk {
  const chunkContent = useProvidedContent
    ? sym.content
    : extractLines(lines, sym.startLine, sym.endLine).join('\n');

  return {
    id: uuidv4(),
    content: chunkContent,
    filePath: options.filePath,
    relativePath: options.filePath,
    startLine: sym.startLine,
    endLine: sym.endLine,
    language: options.language,
    framework: options.framework,
    componentType: options.componentType,
    dependencies: [],
    imports: [],
    exports: [],
    tags: [],
    metadata: {
      symbolAware: true,
      symbolName: sym.name,
      symbolKind: sym.kind,
      symbolPath,
      parentSymbol: parentName ?? undefined,
      chunkStrategy: 'ast-aligned',
      componentName: sym.name
    } as ChunkMetadata
  };
}
