import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import type { ToolContext, ToolResponse } from './types.js';
import { readMemoriesFile } from '../memory/store.js';
import {
  isComplementaryPatternConflict,
  shouldSkipLegacyTestingFrameworkCategory
} from '../patterns/semantics.js';

export const definition: Tool = {
  name: 'get_team_patterns',
  description:
    'Get actionable team pattern recommendations based on codebase analysis. ' +
    'Returns consensus patterns for DI, state management, testing, library wrappers, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Pattern category to retrieve',
        enum: ['all', 'di', 'state', 'testing', 'libraries']
      }
    }
  }
};

export async function handle(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResponse> {
  const { category } = args as { category?: string };

  try {
    const intelligencePath = ctx.paths.intelligence;
    const content = await fs.readFile(intelligencePath, 'utf-8');
    const intelligence = JSON.parse(content);

    const result: any = { status: 'success' };

    if (category === 'all' || !category) {
      result.patterns = intelligence.patterns || {};
      result.goldenFiles = intelligence.goldenFiles || [];
      if (intelligence.tsconfigPaths) {
        result.tsconfigPaths = intelligence.tsconfigPaths;
      }
    } else if (category === 'di') {
      result.dependencyInjection = intelligence.patterns?.dependencyInjection;
    } else if (category === 'state') {
      result.stateManagement = intelligence.patterns?.stateManagement;
    } else if (category === 'testing') {
      result.unitTestFramework = intelligence.patterns?.unitTestFramework;
      result.e2eFramework = intelligence.patterns?.e2eFramework;
      result.testingFramework = intelligence.patterns?.testingFramework;
      result.testMocking = intelligence.patterns?.testMocking;
    } else if (category === 'libraries') {
      result.topUsed = intelligence.importGraph?.topUsed || [];
      if (intelligence.tsconfigPaths) {
        result.tsconfigPaths = intelligence.tsconfigPaths;
      }
    }

    // Load and append matching memories
    try {
      const allMemories = await readMemoriesFile(ctx.paths.memory);

      // Map pattern categories to decision categories
      const categoryMap: Record<string, string[]> = {
        all: ['tooling', 'architecture', 'testing', 'dependencies', 'conventions'],
        di: ['architecture', 'conventions'],
        state: ['architecture', 'conventions'],
        testing: ['testing'],
        libraries: ['dependencies']
      };

      const relevantCategories = categoryMap[category || 'all'] || [];
      const matchingMemories = allMemories.filter((m) =>
        relevantCategories.includes(m.category)
      );

      if (matchingMemories.length > 0) {
        result.memories = matchingMemories;
      }
    } catch (_error) {
      // No memory file yet, that's fine - don't fail the whole request
    }

    // Detect pattern conflicts: primary < 80% and any alternative > 20%
    const conflicts: any[] = [];
    const patternsData = intelligence.patterns || {};
    const hasUnitTestFramework = Boolean(patternsData.unitTestFramework?.primary);
    for (const [cat, data] of Object.entries<any>(patternsData)) {
      if (shouldSkipLegacyTestingFrameworkCategory(cat, patternsData)) continue;
      if (category && category !== 'all' && cat !== category) continue;
      if (!data.primary || !data.alsoDetected?.length) continue;

      const primaryFreq = parseFloat(data.primary.frequency) || 100;
      if (primaryFreq >= 80) continue;

      for (const alt of data.alsoDetected) {
        const altFreq = parseFloat(alt.frequency) || 0;
        if (altFreq < 20) continue;
        if (isComplementaryPatternConflict(cat, data.primary.name, alt.name)) continue;
        if (hasUnitTestFramework && cat === 'testingFramework') continue;

        conflicts.push({
          category: cat,
          primary: {
            name: data.primary.name,
            adoption: data.primary.frequency,
            trend: data.primary.trend
          },
          alternative: {
            name: alt.name,
            adoption: alt.frequency,
            trend: alt.trend
          },
          note: `Split decision: ${data.primary.frequency} ${data.primary.name} (${data.primary.trend || 'unknown'}) vs ${alt.frequency} ${alt.name} (${alt.trend || 'unknown'})`
        });
      }
    }
    if (conflicts.length > 0) {
      result.conflicts = conflicts;
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'error',
              message: 'Failed to load team patterns',
              error: error instanceof Error ? error.message : String(error)
            },
            null,
            2
          )
        }
      ]
    };
  }
}
