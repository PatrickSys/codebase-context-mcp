import { describe, it, expect, beforeAll } from 'vitest';
import {
  isComplementaryPatternCategory,
  isComplementaryPatternConflict,
  registerComplementaryPatterns,
  shouldSkipLegacyTestingFrameworkCategory
} from '../src/patterns/semantics.js';

describe('pattern semantics helpers', () => {
  // Register Angular complementary patterns (in prod this happens at startup via index.ts)
  beforeAll(() => {
    registerComplementaryPatterns('reactivity', ['Computed', 'Effect']);
  });
  it('treats computed/effect reactivity pair as complementary', () => {
    expect(isComplementaryPatternConflict('reactivity', 'Computed', 'Effect')).toBe(true);
    expect(isComplementaryPatternConflict('reactivity', 'Effect', 'Computed')).toBe(true);
  });

  it('does not mark unrelated categories as complementary conflicts', () => {
    expect(isComplementaryPatternConflict('stateManagement', 'RxJS', 'Signals')).toBe(false);
    expect(isComplementaryPatternConflict('reactivity', 'Computed', 'Signals')).toBe(false);
  });

  it('detects complementary reactivity categories', () => {
    expect(isComplementaryPatternCategory('reactivity', ['Computed', 'Effect'])).toBe(true);
    expect(isComplementaryPatternCategory('reactivity', ['Effect', 'Computed'])).toBe(true);
    expect(isComplementaryPatternCategory('reactivity', ['Computed', 'RxJS'])).toBe(false);
  });

  it('suppresses legacy testingFramework when unitTestFramework exists', () => {
    expect(
      shouldSkipLegacyTestingFrameworkCategory('testingFramework', {
        unitTestFramework: { primary: { name: 'Jest' } }
      })
    ).toBe(true);

    expect(
      shouldSkipLegacyTestingFrameworkCategory('testingFramework', {
        testingFramework: { primary: { name: 'Jest' } }
      })
    ).toBe(false);
  });
});
