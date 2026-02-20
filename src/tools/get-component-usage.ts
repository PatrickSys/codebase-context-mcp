import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import type { ToolContext, ToolResponse } from './types.js';

export const definition: Tool = {
  name: 'get_component_usage',
  description:
    'Find WHERE a library or component is used in the codebase. ' +
    "This is 'Find Usages' - returns all files that import a given package/module. " +
    "Example: get_component_usage('@mycompany/utils') -> shows all files using it.",
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          "Import source to find usages for (e.g., 'primeng/table', '@mycompany/ui/button', 'lodash')"
      }
    },
    required: ['name']
  }
};

export async function handle(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResponse> {
  const { name: componentName } = args as { name: string };

  try {
    const intelligencePath = ctx.paths.intelligence;
    const content = await fs.readFile(intelligencePath, 'utf-8');
    const intelligence = JSON.parse(content);

    const importGraph = intelligence.importGraph || {};
    const usages = importGraph.usages || {};

    // Find matching usages (exact match or partial match)
    let matchedUsage = usages[componentName];

    // Try partial match if exact match not found
    if (!matchedUsage) {
      const matchingKeys = Object.keys(usages).filter(
        (key) => key.includes(componentName) || componentName.includes(key)
      );
      if (matchingKeys.length > 0) {
        matchedUsage = usages[matchingKeys[0]];
      }
    }

    if (matchedUsage) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'success',
                component: componentName,
                usageCount: matchedUsage.usageCount,
                usedIn: matchedUsage.usedIn
              },
              null,
              2
            )
          }
        ]
      };
    } else {
      // Show top used as alternatives
      const topUsed = importGraph.topUsed || [];
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'not_found',
                component: componentName,
                message: `No usages found for '${componentName}'.`,
                suggestions: topUsed.slice(0, 10)
              },
              null,
              2
            )
          }
        ]
      };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'error',
              message: 'Failed to get component usage. Run indexing first.',
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
