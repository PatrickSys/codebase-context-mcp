import { describe, it, expect } from 'vitest';
import type { Memory } from '../src/types/index.js';
import {
  normalizeMemories,
  filterMemories,
  applyUnfilteredLimit,
  sortMemoriesByRecency
} from '../src/memory/store.js';

describe('Memory store', () => {
  it('normalizes legacy "decision" field into "memory" and defaults type', () => {
    const raw = [
      {
        id: 'abc123',
        category: 'tooling',
        decision: 'Use pnpm',
        reason: 'Workspace performance',
        date: '2026-01-01T00:00:00.000Z'
      }
    ];

    const normalized = normalizeMemories(raw);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toEqual({
      id: 'abc123',
      type: 'decision',
      category: 'tooling',
      memory: 'Use pnpm',
      reason: 'Workspace performance',
      date: '2026-01-01T00:00:00.000Z'
    });
  });

  it('filters by category/type/query', () => {
    const memories: Memory[] = [
      {
        id: '1',
        type: 'convention',
        category: 'conventions',
        memory: 'Use CSS tokens',
        reason: 'Consistency',
        date: '2026-01-01T00:00:00.000Z'
      },
      {
        id: '2',
        type: 'gotcha',
        category: 'testing',
        memory: 'Avoid lodash debounce',
        reason: 'Breaks zone.js',
        date: '2026-01-02T00:00:00.000Z'
      }
    ];

    expect(filterMemories(memories, { category: 'testing' })).toHaveLength(1);
    expect(filterMemories(memories, { type: 'convention' })).toHaveLength(1);
    expect(filterMemories(memories, { query: 'zone.js' })).toHaveLength(1);
  });

  it('applies unfiltered limit using recency ordering', () => {
    const base: Memory[] = [];
    for (let i = 0; i < 25; i++) {
      base.push({
        id: String(i),
        type: 'decision',
        category: 'tooling',
        memory: `m${i}`,
        reason: 'r',
        date: new Date(2026, 0, i + 1).toISOString()
      });
    }

    const shuffled = [...base].reverse();
    const limited = applyUnfilteredLimit(shuffled, {}, 20);
    expect(limited.truncated).toBe(true);
    expect(limited.totalCount).toBe(25);
    expect(limited.memories).toHaveLength(20);

    const sorted = sortMemoriesByRecency(shuffled);
    expect(limited.memories[0].id).toBe(sorted[0].id);
  });
});
