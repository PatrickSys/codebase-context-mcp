/**
 * Core Indexer - Orchestrates codebase indexing
 * Scans files, delegates to analyzers, creates embeddings, stores in vector DB
 */

import { promises as fs } from "fs";
import path from "path";
import { glob } from "glob";
import ignore from "ignore";
import {
  CodebaseMetadata,
  CodeChunk,
  IndexingProgress,
  IndexingStats,
  IndexingPhase,
  CodebaseConfig,
  AnalysisResult,
} from "../types/index.js";
import { analyzerRegistry } from "./analyzer-registry.js";
import { isCodeFile, isBinaryFile } from "../utils/language-detection.js";
import {
  getEmbeddingProvider,
  EmbeddingProvider,
} from "../embeddings/index.js";
import {
  getStorageProvider,
  VectorStorageProvider,
  CodeChunkWithEmbedding,
} from "../storage/index.js";

export interface IndexerOptions {
  rootPath: string;
  config?: Partial<CodebaseConfig>;
  onProgress?: (progress: IndexingProgress) => void;
}

export class CodebaseIndexer {
  private rootPath: string;
  private config: CodebaseConfig;
  private progress: IndexingProgress;
  private onProgressCallback?: (progress: IndexingProgress) => void;

  constructor(options: IndexerOptions) {
    this.rootPath = path.resolve(options.rootPath);
    this.config = this.mergeConfig(options.config);
    this.onProgressCallback = options.onProgress;

    this.progress = {
      phase: "initializing",
      percentage: 0,
      filesProcessed: 0,
      totalFiles: 0,
      chunksCreated: 0,
      errors: [],
      startedAt: new Date(),
    };
  }

  private mergeConfig(userConfig?: Partial<CodebaseConfig>): CodebaseConfig {
    const defaultConfig: CodebaseConfig = {
      analyzers: {
        angular: { enabled: true, priority: 100 },
        react: { enabled: false, priority: 90 },
        vue: { enabled: false, priority: 90 },
        generic: { enabled: true, priority: 10 },
      },
      include: ["**/*.{ts,tsx,js,jsx,html,css,scss,sass,less}"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "build/**",
        ".git/**",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/*.test.js",
        "coverage/**",
      ],
      respectGitignore: true,
      parsing: {
        maxFileSize: 1048576, // 1MB
        chunkSize: 100,
        chunkOverlap: 10,
        parseTests: false,
        parseNodeModules: false,
      },
      styleGuides: {
        autoDetect: true,
        paths: ["STYLE_GUIDE.md", "docs/style-guide.md", "ARCHITECTURE.md"],
        parseMarkdown: true,
      },
      documentation: {
        autoDetect: true,
        includeReadmes: true,
        includeChangelogs: false,
      },
      embedding: {
        provider: "transformers",
        model: "Xenova/bge-base-en-v1.5",
        batchSize: 100,
      },
      storage: {
        provider: "lancedb",
        path: "./codebase-index",
      },
    };

    return {
      ...defaultConfig,
      ...userConfig,
      analyzers: { ...defaultConfig.analyzers, ...userConfig?.analyzers },
      parsing: { ...defaultConfig.parsing, ...userConfig?.parsing },
      styleGuides: { ...defaultConfig.styleGuides, ...userConfig?.styleGuides },
      documentation: {
        ...defaultConfig.documentation,
        ...userConfig?.documentation,
      },
      embedding: { ...defaultConfig.embedding, ...userConfig?.embedding },
      storage: { ...defaultConfig.storage, ...userConfig?.storage },
    };
  }

  async index(): Promise<IndexingStats> {
    const startTime = Date.now();
    const stats: IndexingStats = {
      totalFiles: 0,
      indexedFiles: 0,
      skippedFiles: 0,
      totalChunks: 0,
      totalLines: 0,
      duration: 0,
      avgChunkSize: 0,
      componentsByType: {},
      componentsByLayer: {
        presentation: 0,
        business: 0,
        data: 0,
        state: 0,
        core: 0,
        shared: 0,
        feature: 0,
        infrastructure: 0,
        unknown: 0,
      },
      errors: [],
      startedAt: new Date(),
    };

    try {
      // Phase 1: Scanning
      this.updateProgress("scanning", 0);
      const files = await this.scanFiles();
      stats.totalFiles = files.length;
      this.progress.totalFiles = files.length;

      console.log(`Found ${files.length} files to index`);

      // Phase 2: Analyzing & Parsing
      this.updateProgress("analyzing", 0);
      const allChunks: CodeChunk[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this.progress.currentFile = file;
        this.progress.filesProcessed = i + 1;
        this.progress.percentage = Math.round(((i + 1) / files.length) * 100);

        try {
          const content = await fs.readFile(file, "utf-8");
          const result = await analyzerRegistry.analyzeFile(file, content);

          if (result) {
            allChunks.push(...result.chunks);
            stats.indexedFiles++;
            stats.totalLines += content.split("\n").length;

            // Update component statistics
            for (const component of result.components) {
              if (component.componentType) {
                stats.componentsByType[component.componentType] =
                  (stats.componentsByType[component.componentType] || 0) + 1;
              }
              if (component.layer) {
                stats.componentsByLayer[component.layer]++;
              }
            }
          } else {
            stats.skippedFiles++;
          }
        } catch (error) {
          stats.skippedFiles++;
          stats.errors.push({
            filePath: file,
            error: error instanceof Error ? error.message : String(error),
            phase: "analyzing",
            timestamp: new Date(),
          });
        }

        if (this.onProgressCallback) {
          this.onProgressCallback(this.progress);
        }
      }

      stats.totalChunks = allChunks.length;
      stats.avgChunkSize =
        allChunks.length > 0
          ? Math.round(
              allChunks.reduce((sum, c) => sum + c.content.length, 0) /
                allChunks.length
            )
          : 0;

      // Phase 3: Embedding
      this.updateProgress("embedding", 50);
      console.log(`Creating embeddings for ${allChunks.length} chunks...`);

      // Initialize embedding provider
      const embeddingProvider = await getEmbeddingProvider();

      // Generate embeddings for all chunks
      const chunksWithEmbeddings: CodeChunkWithEmbedding[] = [];
      const batchSize = 32;

      for (let i = 0; i < allChunks.length; i += batchSize) {
        const batch = allChunks.slice(i, i + batchSize);
        const texts = batch.map((chunk) => {
          // Create a searchable text representation
          const parts = [chunk.content];
          if (chunk.metadata?.componentName) {
            parts.unshift(`Component: ${chunk.metadata.componentName}`);
          }
          if (chunk.componentType) {
            parts.unshift(`Type: ${chunk.componentType}`);
          }
          return parts.join("\n");
        });

        const embeddings = await embeddingProvider.embedBatch(texts);

        for (let j = 0; j < batch.length; j++) {
          chunksWithEmbeddings.push({
            ...batch[j],
            embedding: embeddings[j],
          });
        }

        // Update progress
        const embeddingProgress = 50 + Math.round((i / allChunks.length) * 25);
        this.updateProgress("embedding", embeddingProgress);

        if ((i + batchSize) % 100 === 0 || i + batchSize >= allChunks.length) {
          console.log(
            `Embedded ${Math.min(i + batchSize, allChunks.length)}/${
              allChunks.length
            } chunks`
          );
        }
      }

      // Phase 4: Storing
      this.updateProgress("storing", 75);
      console.log(`Storing ${allChunks.length} chunks...`);

      // Store in LanceDB for vector search
      const storagePath = path.join(this.rootPath, ".codebase-index");
      const storageProvider = await getStorageProvider({ path: storagePath });
      await storageProvider.clear(); // Clear existing index
      await storageProvider.store(chunksWithEmbeddings);

      // Also save JSON for keyword search (Fuse.js)
      const indexPath = path.join(this.rootPath, ".codebase-index.json");
      await fs.writeFile(indexPath, JSON.stringify(allChunks, null, 2));

      // Phase 5: Complete
      this.updateProgress("complete", 100);

      stats.duration = Date.now() - startTime;
      stats.completedAt = new Date();

      console.log(`Indexing complete in ${stats.duration}ms`);
      console.log(
        `Indexed ${stats.indexedFiles} files, ${stats.totalChunks} chunks`
      );

      return stats;
    } catch (error) {
      this.progress.phase = "error";
      stats.errors.push({
        filePath: this.rootPath,
        error: error instanceof Error ? error.message : String(error),
        phase: this.progress.phase,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  private async scanFiles(): Promise<string[]> {
    const files: string[] = [];

    // Read .gitignore if respecting it
    let ig: ReturnType<typeof ignore.default> | null = null;
    if (this.config.respectGitignore) {
      try {
        const gitignorePath = path.join(this.rootPath, ".gitignore");
        const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
        ig = ignore.default().add(gitignoreContent);
      } catch (error) {
        // No .gitignore or couldn't read it
      }
    }

    // Scan with glob
    const includePatterns = this.config.include || ["**/*"];
    const excludePatterns = this.config.exclude || [];

    for (const pattern of includePatterns) {
      const matches = await glob(pattern, {
        cwd: this.rootPath,
        absolute: true,
        ignore: excludePatterns,
        nodir: true,
      });

      for (const file of matches) {
        const relativePath = path.relative(this.rootPath, file);

        // Check gitignore
        if (ig && ig.ignores(relativePath)) {
          continue;
        }

        // Check if it's a code file
        if (!isCodeFile(file) || isBinaryFile(file)) {
          continue;
        }

        // Check file size
        try {
          const stats = await fs.stat(file);
          if (stats.size > (this.config.parsing?.maxFileSize || 1048576)) {
            console.warn(`Skipping large file: ${file} (${stats.size} bytes)`);
            continue;
          }
        } catch (error) {
          continue;
        }

        files.push(file);
      }
    }

    return files;
  }

  private updateProgress(phase: IndexingPhase, percentage: number): void {
    this.progress.phase = phase;
    this.progress.percentage = percentage;

    if (this.onProgressCallback) {
      this.onProgressCallback(this.progress);
    }
  }

  async detectMetadata(): Promise<CodebaseMetadata> {
    // Try to use the most specific analyzer for metadata detection
    const primaryAnalyzer = analyzerRegistry.getAll()[0]; // Highest priority

    if (primaryAnalyzer) {
      return await primaryAnalyzer.detectCodebaseMetadata(this.rootPath);
    }

    // Fallback metadata
    return {
      name: path.basename(this.rootPath),
      rootPath: this.rootPath,
      languages: [],
      dependencies: [],
      architecture: {
        type: "mixed",
        layers: {
          presentation: 0,
          business: 0,
          data: 0,
          state: 0,
          core: 0,
          shared: 0,
          feature: 0,
          infrastructure: 0,
          unknown: 0,
        },
        patterns: [],
      },
      styleGuides: [],
      documentation: [],
      projectStructure: {
        type: "single-app",
      },
      statistics: {
        totalFiles: 0,
        totalLines: 0,
        totalComponents: 0,
        componentsByType: {},
        componentsByLayer: {
          presentation: 0,
          business: 0,
          data: 0,
          state: 0,
          core: 0,
          shared: 0,
          feature: 0,
          infrastructure: 0,
          unknown: 0,
        },
      },
      customMetadata: {},
    };
  }

  getProgress(): IndexingProgress {
    return { ...this.progress };
  }
}
