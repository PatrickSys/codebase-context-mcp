import { promises as fs } from "fs";
import path from "path";
import {
  AnalysisResult,
  CodebaseMetadata,
  CodeChunk,
  FrameworkAnalyzer,
} from "../../types/index.js";
import { AngularAnalyzer } from "../angular/index.js";
import { GenericAnalyzer } from "../generic/index.js";
import { NextJsAnalyzer } from "../nextjs/index.js";
import { ReactAnalyzer } from "../react/index.js";
import {
  detectEcosystemFromPackageJsons,
  readRootPackageJson,
  scanWorkspacePackageJsons,
} from "./package-json.js";

/**
 * Ecosystem Analyzer
 *
 * This analyzer is intentionally NOT used for per-file analysis. Its job is to
 * orchestrate codebase-level metadata detection across multiple frameworks
 * (Angular, React, Next.js, etc).
 */
export class EcosystemAnalyzer implements FrameworkAnalyzer {
  readonly name = "ecosystem";
  readonly version = "1.0.0";
  readonly supportedExtensions: string[] = [];
  readonly priority = 1000;

  canAnalyze(): boolean {
    return false;
  }

  async analyze(filePath: string, content: string): Promise<AnalysisResult> {
    return {
      filePath,
      language: "unknown",
      framework: this.name,
      components: [],
      imports: [],
      exports: [],
      dependencies: [],
      metadata: {
        analyzer: this.name,
        skipped: true,
      },
      chunks: [] satisfies CodeChunk[],
    };
  }

  async detectCodebaseMetadata(rootPath: string): Promise<CodebaseMetadata> {
    const packageJsons = await scanWorkspacePackageJsons(rootPath);
    const rootPackage = await readRootPackageJson(rootPath);
    if (rootPackage && !packageJsons.some((p) => p.filePath === rootPackage.filePath)) {
      packageJsons.unshift(rootPackage);
    }

    const ecosystem = detectEcosystemFromPackageJsons(packageJsons);

    // Choose a specific analyzer for deeper metadata (gated by package.json deps).
    const analyzer: FrameworkAnalyzer =
      ecosystem.primaryFramework === "nextjs"
        ? new NextJsAnalyzer()
        : ecosystem.primaryFramework === "angular"
          ? new AngularAnalyzer()
          : ecosystem.primaryFramework === "react"
            ? new ReactAnalyzer()
            : new GenericAnalyzer();

    const metadata = await analyzer.detectCodebaseMetadata(rootPath);

    metadata.customMetadata = {
      ...metadata.customMetadata,
      ecosystem: {
        frameworks: ecosystem.frameworks,
        primaryFramework: ecosystem.primaryFramework,
        versions: ecosystem.frameworkVersions,
        tooling: {
          hasTypeScript: ecosystem.hasTypeScript,
          hasNx: ecosystem.hasNx,
        },
        libraries: ecosystem.libraries,
        workspacePackageJsonCount: packageJsons.length,
      },
    };

    // Additional lightweight Next.js router detection for convenience.
    if (ecosystem.primaryFramework === "nextjs") {
      const router = await this.detectNextRouterPresence(rootPath);
      metadata.customMetadata = {
        ...metadata.customMetadata,
        nextjs: router,
      };
    }

    return metadata;
  }

  private async detectNextRouterPresence(
    rootPath: string
  ): Promise<{ hasAppRouter: boolean; hasPagesRouter: boolean }> {
    const candidates = [
      path.join(rootPath, "app"),
      path.join(rootPath, "src", "app"),
      path.join(rootPath, "pages"),
      path.join(rootPath, "src", "pages"),
    ];

    const hasAppRouter = await anyExists(candidates.slice(0, 2));
    const hasPagesRouter = await anyExists(candidates.slice(2));

    return { hasAppRouter, hasPagesRouter };
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function anyExists(paths: string[]): Promise<boolean> {
  for (const p of paths) {
    if (await exists(p)) return true;
  }
  return false;
}

