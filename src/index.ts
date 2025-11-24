#!/usr/bin/env node

/**
 * MCP Server for Codebase Context
 * Provides codebase indexing and semantic search capabilities
 */

import { promises as fs } from "fs";
import path from "path";
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

const ROOT_PATH = process.argv[2] || process.env.CODEBASE_ROOT || process.cwd();

interface IndexState {
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
          description: "Maximum number of results to return (default: 10)",
          default: 10,
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
    description:
      "Get the current indexing status and progress information.",
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
          console.error(
            `[${progress.phase}] ${progress.percentage}%`
          );
        }
      },
    });

    indexState.indexer = indexer;
    const stats = await indexer.index();

    indexState.status = "ready";
    indexState.lastIndexed = new Date();
    indexState.stats = stats;

    console.error(
      `Complete: ${stats.indexedFiles} files, ${stats.totalChunks} chunks in ${(stats.duration / 1000).toFixed(2)}s`
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
        const results = await searcher.search(query, limit || 10, filters);

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
                        duration: `${(indexState.stats.duration / 1000).toFixed(2)}s`,
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
                  message: "Re-indexing started. Check status with get_indexing_status.",
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

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "not_implemented",
                  message:
                    "Style guide search not yet implemented",
                  query,
                  category,
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

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
