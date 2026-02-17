// Complementary pattern pairs are registered by analyzers at startup.
// This keeps the core logic framework-agnostic.
const complementaryPairs: Map<string, Set<string>> = new Map();

/**
 * Register a set of pattern names within a category that are complementary
 * (should appear together, not treated as conflicts).
 * Called by framework analyzers at initialization.
 */
export function registerComplementaryPatterns(category: string, names: string[]): void {
  const existing = complementaryPairs.get(category) ?? new Set<string>();
  for (const name of names) {
    existing.add(name.trim().toLowerCase());
  }
  complementaryPairs.set(category, existing);
}

function normalizePatternName(name: string): string {
  return name.trim().toLowerCase();
}

export function isComplementaryPatternConflict(
  category: string,
  primaryName: string,
  alternativeName: string
): boolean {
  const set = complementaryPairs.get(category);
  if (!set) return false;

  const primary = normalizePatternName(primaryName);
  const alternative = normalizePatternName(alternativeName);

  if (!set.has(primary)) return false;
  if (!set.has(alternative)) return false;

  return primary !== alternative;
}

export function isComplementaryPatternCategory(category: string, patternNames: string[]): boolean {
  const set = complementaryPairs.get(category);
  if (!set || patternNames.length < 2) return false;
  return patternNames.every((name) => set.has(normalizePatternName(name)));
}

export function shouldSkipLegacyTestingFrameworkCategory(
  category: string,
  patterns: Record<string, any>
): boolean {
  return category === 'testingFramework' && Boolean(patterns.unitTestFramework?.primary);
}
