#!/usr/bin/env node

/**
 * MCP Server for Codebase Context
 * Provides codebase indexing and semantic search capabilities
 */

import { promises as fs } from "fs";
import path from "path";
import { glob } from "glob";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { CodebaseIndexer } from "./core/indexer.js";
import { IndexingStats } from "./types/index.js";
import { CodebaseSearcher } from "./core/search.js";
import { analyzerRegistry } from "./core/analyzer-registry.js";
import { AngularAnalyzer } from "./analyzers/angular/index.js";
import { GenericAnalyzer } from "./analyzers/generic/index.js";

analyzerRegistry.register(new AngularAnalyzer());
analyzerRegistry.register(new GenericAnalyzer());

// Resolve root path with validation
function resolveRootPath(): string {
  const arg = process.argv[2];
  const envPath = process.env.CODEBASE_ROOT;

  // Priority: CLI arg > env var > cwd
  let rootPath = arg || envPath || process.cwd();
  rootPath = path.resolve(rootPath);

  // Warn if using cwd as fallback
  if (!arg && !envPath) {
    console.error(
      `WARNING: No project path specified. Using current directory: ${rootPath}`
    );
    console.error(
      `Hint: Specify path as CLI argument or set CODEBASE_ROOT env var`
    );
  }

  return rootPath;
}

const ROOT_PATH = resolveRootPath();

export interface IndexState {
  status: "idle" | "indexing" | "ready" | "error";
  lastIndexed?: Date;
  stats?: IndexingStats;
  error?: string;
  indexer?: CodebaseIndexer;
}

const indexState: IndexState = {
  status: "idle",
};

const server = new Server(
  {
    name: "codebase-context-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const TOOLS: Tool[] = [
  {
    name: "search_codebase",
    description:
      "Search the indexed codebase using natural language queries. Returns code summaries with file locations. " +
      "Supports framework-specific queries and architectural layer filtering. " +
      "Use the returned filePath with other tools to read complete file contents.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language search query",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 5)",
          default: 5,
        },
        filters: {
          type: "object",
          description: "Optional filters",
          properties: {
            framework: {
              type: "string",
              description: "Filter by framework (angular, react, vue)",
            },
            language: {
              type: "string",
              description: "Filter by programming language",
            },
            componentType: {
              type: "string",
              description:
                "Filter by component type (component, service, directive, etc.)",
            },
            layer: {
              type: "string",
              description:
                "Filter by architectural layer (presentation, business, data, state, core, shared)",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Filter by tags",
            },
          },
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_codebase_metadata",
    description:
      "Get codebase metadata including framework information, dependencies, architecture patterns, " +
      "and project statistics.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_indexing_status",
    description: "Get the current indexing status and progress information.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "refresh_index",
    description:
      "Trigger a complete re-indexing of the codebase. Use when index corruption is suspected.",
    inputSchema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Reason for refreshing the index (for logging)",
        },
      },
    },
  },
  {
    name: "get_style_guide",
    description:
      "Query style guide rules and architectural patterns from project documentation.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Query for specific style guide rules (e.g., "component naming", "service patterns")',
        },
        category: {
          type: "string",
          description:
            "Filter by category (naming, structure, patterns, testing)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_analyzer_info",
    description:
      "Get information about registered framework analyzers and their capabilities.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

async function performIndexing(): Promise<void> {
  indexState.status = "indexing";
  console.error(`Indexing: ${ROOT_PATH}`);

  try {
    const indexer = new CodebaseIndexer({
      rootPath: ROOT_PATH,
      onProgress: (progress) => {
        if (progress.percentage % 10 === 0) {
          console.error(`[${progress.phase}] ${progress.percentage}%`);
        }
      },
    });

    indexState.indexer = indexer;
    const stats = await indexer.index();

    indexState.status = "ready";
    indexState.lastIndexed = new Date();
    indexState.stats = stats;

    console.error(
      `Complete: ${stats.indexedFiles} files, ${stats.totalChunks} chunks in ${(
        stats.duration / 1000
      ).toFixed(2)}s`
    );
  } catch (error) {
    indexState.status = "error";
    indexState.error = error instanceof Error ? error.message : String(error);
    console.error("Indexing failed:", indexState.error);
  }
}

async function shouldReindex(): Promise<boolean> {
  const indexPath = path.join(ROOT_PATH, ".codebase-index.json");
  try {
    await fs.access(indexPath);
    return false;
  } catch {
    return true;
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_codebase": {
        const { query, limit, filters } = args as any;

        if (indexState.status === "indexing") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "indexing",
                    message: "Index is still being built. Retry in a moment.",
                    progress: indexState.indexer?.getProgress(),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (indexState.status === "error") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "error",
                    message: `Indexing failed: ${indexState.error}`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const searcher = new CodebaseSearcher(ROOT_PATH);
        const results = await searcher.search(query, limit || 5, filters);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  results: results.map((r) => ({
                    summary: r.summary,
                    snippet: r.snippet,
                    filePath: `${r.filePath}:${r.startLine}-${r.endLine}`,
                    score: r.score,
                    relevanceReason: r.relevanceReason,
                    componentType: r.componentType,
                    layer: r.layer,
                    framework: r.framework,
                  })),
                  totalResults: results.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_indexing_status": {
        const progress = indexState.indexer?.getProgress();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: indexState.status,
                  rootPath: ROOT_PATH,
                  lastIndexed: indexState.lastIndexed?.toISOString(),
                  stats: indexState.stats
                    ? {
                        totalFiles: indexState.stats.totalFiles,
                        indexedFiles: indexState.stats.indexedFiles,
                        totalChunks: indexState.stats.totalChunks,
                        duration: `${(indexState.stats.duration / 1000).toFixed(
                          2
                        )}s`,
                      }
                    : undefined,
                  progress: progress
                    ? {
                        phase: progress.phase,
                        percentage: progress.percentage,
                        filesProcessed: progress.filesProcessed,
                        totalFiles: progress.totalFiles,
                      }
                    : undefined,
                  error: indexState.error,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "refresh_index": {
        const { reason } = args as { reason?: string };

        console.error(`Refresh requested: ${reason || "Manual trigger"}`);

        performIndexing();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "started",
                  message:
                    "Re-indexing started. Check status with get_indexing_status.",
                  reason,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_codebase_metadata": {
        const indexer = new CodebaseIndexer({ rootPath: ROOT_PATH });
        const metadata = await indexer.detectMetadata();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  metadata: {
                    name: metadata.name,
                    framework: metadata.framework,
                    languages: metadata.languages,
                    dependencies: metadata.dependencies.slice(0, 20),
                    architecture: metadata.architecture,
                    projectStructure: metadata.projectStructure,
                    statistics: metadata.statistics,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_style_guide": {
        const { query, category } = args as {
          query: string;
          category?: string;
        };

        const styleGuidePatterns = [
          "STYLE_GUIDE.md",
          "CODING_STYLE.md",
          "ARCHITECTURE.md",
          "CONTRIBUTING.md",
          "docs/style-guide.md",
          "docs/coding-style.md",
          "docs/ARCHITECTURE.md",
        ];

        const foundGuides: Array<{
          file: string;
          content: string;
          relevantSections: string[];
        }> = [];
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/);

        for (const pattern of styleGuidePatterns) {
          try {
            const files = await glob(pattern, {
              cwd: ROOT_PATH,
              absolute: true,
            });
            for (const file of files) {
              try {
                // Normalize line endings to \n for consistent output
                const rawContent = await fs.readFile(file, "utf-8");
                const content = rawContent.replace(/\r\n/g, "\n");
                const relativePath = path.relative(ROOT_PATH, file);

                // Find relevant sections based on query
                const sections = content.split(/^##\s+/m);
                const relevantSections: string[] = [];

                for (const section of sections) {
                  const sectionLower = section.toLowerCase();
                  const isRelevant = queryTerms.some((term) =>
                    sectionLower.includes(term)
                  );
                  if (isRelevant) {
                    // Limit section size to ~500 words
                    const words = section.split(/\s+/);
                    const truncated = words.slice(0, 500).join(" ");
                    relevantSections.push(
                      "## " +
                        (words.length > 500
                          ? truncated + "..."
                          : section.trim())
                    );
                  }
                }

                if (relevantSections.length > 0) {
                  foundGuides.push({
                    file: relativePath,
                    content: content.slice(0, 200) + "...",
                    relevantSections: relevantSections.slice(0, 3), // Max 3 sections per file
                  });
                }
              } catch (e) {
                // Skip unreadable files
              }
            }
          } catch (e) {
            // Pattern didn't match, continue
          }
        }

        if (foundGuides.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "no_results",
                    message: `No style guide content found matching: ${query}`,
                    searchedPatterns: styleGuidePatterns,
                    hint: "Try broader terms like 'naming', 'patterns', 'testing', 'components'",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  query,
                  category,
                  results: foundGuides,
                  totalFiles: foundGuides.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_analyzer_info": {
        const analyzers = analyzerRegistry.getStats();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  analyzers: analyzers.map((a) => ({
                    name: a.name,
                    priority: a.priority,
                    supportedExtensions: a.extensions,
                  })),
                  total: analyzers.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: `Unknown tool: ${name}`,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  console.error("Codebase Context MCP Server");
  console.error(`Root: ${ROOT_PATH}`);
  console.error(
    `Analyzers: ${analyzerRegistry
      .getAll()
      .map((a) => a.name)
      .join(", ")}`
  );

  // Validate root path exists and is a directory
  try {
    const stats = await fs.stat(ROOT_PATH);
    if (!stats.isDirectory()) {
      console.error(`ERROR: Root path is not a directory: ${ROOT_PATH}`);
      console.error(`Please specify a valid project directory.`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`ERROR: Root path does not exist: ${ROOT_PATH}`);
    console.error(`Please specify a valid project directory.`);
    process.exit(1);
  }

  // Check for package.json to confirm it's a project root
  try {
    await fs.access(path.join(ROOT_PATH, "package.json"));
    console.error(`Project detected: ${path.basename(ROOT_PATH)}`);
  } catch {
    console.error(
      `WARNING: No package.json found. This may not be a project root.`
    );
  }

  const needsIndex = await shouldReindex();

  if (needsIndex) {
    console.error("Starting indexing...");
    performIndexing();
  } else {
    console.error("Index found. Ready.");
    indexState.status = "ready";
    indexState.lastIndexed = new Date();
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Server ready");
}

// Export server components for programmatic use
export { server, performIndexing, resolveRootPath, shouldReindex, TOOLS };

// Only auto-start when run directly as CLI (not when imported as module)
// Check if this module is the entry point
const isDirectRun =
  process.argv[1]?.replace(/\\/g, "/").endsWith("index.js") ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("index.ts");

if (isDirectRun) {
  main().catch((error) => {
    console.error("Fatal:", error);
    process.exit(1);
  });
}
