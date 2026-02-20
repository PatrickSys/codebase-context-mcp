import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  parserInstances: [] as Array<{
    parse: ReturnType<typeof vi.fn>;
    setLanguage: ReturnType<typeof vi.fn>;
    setTimeoutMicros: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  }>,
  parseQueue: [] as unknown[],
  parserInit: vi.fn(async () => undefined),
  loadLanguage: vi.fn(async () => ({ name: 'typescript' }))
}));

vi.mock('web-tree-sitter', () => {
  class MockParser {
    static init = state.parserInit;

    parse = vi.fn(() => {
      const next = state.parseQueue.shift();
      if (next instanceof Error) {
        throw next;
      }
      return next ?? null;
    });

    setLanguage = vi.fn(async () => undefined);
    setTimeoutMicros = vi.fn(() => undefined);
    reset = vi.fn(() => undefined);

    constructor() {
      state.parserInstances.push(this);
    }
  }

  return {
    Language: { load: state.loadLanguage },
    Parser: MockParser
  };
});

function fakeTree(options?: { hasError?: boolean; throwOnDescendants?: boolean }) {
  const deleteSpy = vi.fn();
  const shouldThrow = Boolean(options?.throwOnDescendants);

  return {
    rootNode: {
      hasError: Boolean(options?.hasError),
      descendantsOfType: vi.fn(() => {
        if (shouldThrow) {
          throw new Error('forced descendants failure');
        }
        return [];
      })
    },
    delete: deleteSpy
  };
}

describe('Tree-sitter cleanup and parser reset regressions', () => {
  beforeEach(() => {
    vi.resetModules();
    state.parserInstances.length = 0;
    state.parseQueue.length = 0;
    state.parserInit.mockClear();
    state.loadLanguage.mockClear();
  });

  it('deletes tree when root has parse errors', async () => {
    const tree = fakeTree({ hasError: true });
    state.parseQueue.push(tree);

    const { extractTreeSitterSymbols } = await import('../src/utils/tree-sitter');
    const result = await extractTreeSitterSymbols('export function a() {}', 'typescript');

    expect(result).toBeNull();
    expect(tree.delete).toHaveBeenCalledTimes(1);
  });

  it('deletes tree and evicts parser after extraction throw, creating a new parser on retry', async () => {
    const throwingTree = fakeTree({ throwOnDescendants: true });
    const healthyTree = fakeTree();
    state.parseQueue.push(throwingTree, healthyTree);

    const { extractTreeSitterSymbols } = await import('../src/utils/tree-sitter');

    const first = await extractTreeSitterSymbols('export function one() {}', 'typescript');
    const second = await extractTreeSitterSymbols('export function two() {}', 'typescript');

    expect(first).toBeNull();
    expect(throwingTree.delete).toHaveBeenCalledTimes(1);
    expect(second).not.toBeNull();
    expect(state.parserInstances).toHaveLength(2);
  });

  it('wires parse timeout and resets parser when parse returns null', async () => {
    state.parseQueue.push(null);

    const { extractTreeSitterSymbols } = await import('../src/utils/tree-sitter');
    const result = await extractTreeSitterSymbols('export function stalled() {}', 'typescript');

    expect(result).toBeNull();
    expect(state.parserInstances).toHaveLength(1);
    expect(state.parserInstances[0].setTimeoutMicros).toHaveBeenCalled();
    expect(state.parserInstances[0].reset).toHaveBeenCalledTimes(1);
  });
});
