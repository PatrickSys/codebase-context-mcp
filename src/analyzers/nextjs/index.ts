/**
 * Next.js Analyzer - Framework-aware analysis for Next.js projects.
 *
 * Detects:
 * - Router style (App Router vs Pages Router) per file
 * - Routes and route kinds (page/layout/route handler/API)
 * - Server vs Client components ("use client")
 * - Metadata exports (metadata / generateMetadata)
 *
 * No runtime execution: filesystem + AST only.
 */

import { promises as fs } from "fs";
import path from "path";
import { parse } from "@typescript-eslint/typescript-estree";
import {
  AnalysisResult,
  CodebaseMetadata,
  CodeChunk,
  CodeComponent,
  Dependency,
  ExportStatement,
  FrameworkAnalyzer,
  ImportStatement,
} from "../../types/index.js";
import { createChunksFromCode } from "../../utils/chunking.js";
import { parseJsonInWorker } from "../../utils/async-json.js";
import {
  getPackageName,
  mergeDependencies,
  normalizePackageVersion,
  readRootPackageJson,
} from "../orchestration/package-json.js";

type DetectedPattern = { category: string; name: string };

export class NextJsAnalyzer implements FrameworkAnalyzer {
  readonly name = "nextjs";
  readonly version = "1.0.0";
  readonly supportedExtensions = [
    ".tsx",
    ".jsx",
    ".ts",
    ".js",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
  ];
  readonly priority = 90;

  canAnalyze(filePath: string, content?: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (!this.supportedExtensions.includes(ext)) return false;

    // Strong signal from path structure
    if (isInNextAppRouter(filePath) || isInNextPagesRouter(filePath)) return true;

    // Content-based signal
    if (content) {
      if (/\bfrom\s+["']next\//.test(content)) return true;
      if (/\bfrom\s+["']next["']/.test(content)) return true;
    }

    return false;
  }

  async analyze(filePath: string, content: string): Promise<AnalysisResult> {
    const ext = path.extname(filePath).toLowerCase();
    const isJsx = ext.includes("x");
    const language =
      ext === ".ts" || ext === ".tsx" || ext === ".mts" || ext === ".cts"
        ? "typescript"
        : "javascript";
    const relativePath = path.relative(process.cwd(), filePath);

    const components: CodeComponent[] = [];
    const imports: ImportStatement[] = [];
    const exports: ExportStatement[] = [];
    const dependencies: string[] = [];
    const detectedPatterns: DetectedPattern[] = [];

    const routing = analyzeNextFileRouting(filePath, content);

    if (routing.router === "app") detectedPatterns.push({ category: "routing", name: "Next.js App Router" });
    if (routing.router === "pages") detectedPatterns.push({ category: "routing", name: "Next.js Pages Router" });
    if (routing.isClientComponent) detectedPatterns.push({ category: "componentStyle", name: "\"use client\"" });
    if (routing.kind === "route") detectedPatterns.push({ category: "routing", name: "Route Handler" });
    if (routing.kind === "api") detectedPatterns.push({ category: "routing", name: "API Route" });
    if (routing.hasMetadata) detectedPatterns.push({ category: "metadata", name: "Next.js metadata" });

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: true,
        jsx: isJsx,
        sourceType: "module",
      });

      // Imports / dependencies
      for (const node of ast.body) {
        if (node.type === "ImportDeclaration" && node.source.value) {
          const source = node.source.value as string;
          imports.push({
            source,
            imports: node.specifiers.map((s: any) => {
              if (s.type === "ImportDefaultSpecifier") return "default";
              if (s.type === "ImportNamespaceSpecifier") return "*";
              return s.imported?.name || s.local?.name || "unknown";
            }),
            isDefault: node.specifiers.some(
              (s: any) => s.type === "ImportDefaultSpecifier"
            ),
            isDynamic: false,
            line: node.loc?.start.line,
          });

          if (!source.startsWith(".") && !source.startsWith("/")) {
            dependencies.push(getPackageName(source));
          }
        }

        // Named exports
        if (node.type === "ExportNamedDeclaration") {
          if (node.declaration?.type === "FunctionDeclaration" && node.declaration.id) {
            exports.push({ name: node.declaration.id.name, isDefault: false, type: "function" });
          } else if (node.declaration?.type === "ClassDeclaration" && node.declaration.id) {
            exports.push({ name: node.declaration.id.name, isDefault: false, type: "class" });
          } else if (node.declaration?.type === "VariableDeclaration") {
            for (const decl of node.declaration.declarations) {
              if (decl.id.type === "Identifier") {
                exports.push({ name: decl.id.name, isDefault: false, type: "variable" });
              }
            }
          } else if (node.specifiers && node.specifiers.length > 0) {
            for (const s of node.specifiers as any[]) {
              if (s.exported?.name) exports.push({ name: s.exported.name, isDefault: false, type: "re-export" });
            }
          }
        }

        // Default export
        if (node.type === "ExportDefaultDeclaration") {
          exports.push({ name: "default", isDefault: true, type: "default" });
        }
      }

      // Route/page component chunk
      if (routing.kind) {
        const startLine = 1;
        const endLine = content.split("\n").length;
        components.push({
          name: routing.routePath || path.basename(filePath),
          type: "module",
          componentType: routing.kind,
          startLine,
          endLine,
          metadata: {
            nextjs: routing,
          },
        });
      }
    } catch (error) {
      console.warn(`Failed to parse Next.js file ${filePath}:`, error);
    }

    const uniqueDependencies = Array.from(new Set(dependencies)).sort();

    const chunks = await createChunksFromCode(
      content,
      filePath,
      relativePath,
      language,
      components,
      {
        framework: "nextjs",
        detectedPatterns,
        nextjs: routing,
      }
    );

    return {
      filePath,
      language,
      framework: "nextjs",
      components,
      imports,
      exports,
      dependencies: uniqueDependencies.map((name) => ({
        name,
        category: this.categorizeDependency(name),
      })),
      metadata: {
        analyzer: this.name,
        nextjs: routing,
        detectedPatterns,
      },
      chunks,
    };
  }

  async detectCodebaseMetadata(rootPath: string): Promise<CodebaseMetadata> {
    const rootPkg = await readRootPackageJson(rootPath);
    const packageJson = rootPkg?.packageJson;

    const projectName = packageJson?.name || path.basename(rootPath);
    const allDeps = packageJson ? mergeDependencies(packageJson) : {};

    const nextVersion = normalizePackageVersion(allDeps["next"]) || "unknown";

    const dependencies: Dependency[] = Object.entries(allDeps).map(([name, version]) => ({
      name,
      version: version as string,
      category: this.categorizeDependency(name),
    }));

    const routerPresence = await detectNextRouterPresence(rootPath);

    // Basic statistics from existing index if available (same pattern as Angular)
    const statistics = await tryLoadIndexStatistics(rootPath);

    return {
      name: projectName,
      rootPath,
      framework: {
        name: "Next.js",
        version: nextVersion,
        type: "nextjs",
        variant: routerPresence.hasAppRouter && routerPresence.hasPagesRouter
          ? "hybrid"
          : routerPresence.hasAppRouter
            ? "app-router"
            : routerPresence.hasPagesRouter
              ? "pages-router"
              : "unknown",
        stateManagement: detectStateLibraries(allDeps),
        uiLibraries: detectUiLibraries(allDeps),
        testingFrameworks: detectTestingLibraries(allDeps),
      },
      languages: [],
      dependencies,
      architecture: {
        type: "feature-based",
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
      statistics,
      customMetadata: {
        nextjs: routerPresence,
      },
    };
  }

  summarize(chunk: CodeChunk): string {
    const next = chunk.metadata?.nextjs;
    if (next?.kind && next?.routePath) {
      const kind = next.kind;
      const router = next.router || "unknown";
      const client = next.isClientComponent ? "client" : "server";
      return `Next.js ${kind} for "${next.routePath}" (${router}, ${client}).`;
    }
    return `Next.js code in ${path.basename(chunk.filePath)}: lines ${chunk.startLine}-${chunk.endLine}.`;
  }

  private categorizeDependency(name: string): Dependency["category"] {
    if (name === "next") return "framework";
    if (name === "react" || name === "react-dom") return "framework";
    if (name.startsWith("@reduxjs/") || name === "redux" || name === "zustand") return "state";
    if (name === "@tanstack/react-query" || name === "swr" || name === "@apollo/client") return "http";
    if (name === "tailwindcss" || name === "@mui/material" || name === "styled-components") return "ui";
    if (name === "vitest" || name === "jest" || name === "@testing-library/react") return "testing";
    if (name === "typescript" || name === "eslint" || name === "vite") return "build";
    return "other";
  }
}

function isInNextAppRouter(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.includes("/app/") || normalized.includes("/src/app/");
}

function isInNextPagesRouter(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.includes("/pages/") || normalized.includes("/src/pages/");
}

function analyzeNextFileRouting(filePath: string, content: string): {
  router: "app" | "pages" | "unknown";
  kind: "page" | "layout" | "route" | "api" | "unknown";
  routePath: string | null;
  isClientComponent: boolean;
  hasMetadata: boolean;
} {
  const normalized = filePath.replace(/\\/g, "/");
  const base = path.basename(normalized);
  const baseName = path.basename(base, path.extname(base));

  const router: "app" | "pages" | "unknown" = isInNextAppRouter(filePath)
    ? "app"
    : isInNextPagesRouter(filePath)
      ? "pages"
      : "unknown";

  const isClientComponent = hasUseClientDirective(content);
  const hasMetadata = /\bexport\s+(?:const|function)\s+(metadata|generateMetadata)\b/.test(content);

  let kind: "page" | "layout" | "route" | "api" | "unknown" = "unknown";
  if (router === "app") {
    if (base.startsWith("page.")) kind = "page";
    else if (base.startsWith("layout.")) kind = "layout";
    else if (base.startsWith("route.")) kind = "route";
    else kind = "unknown";
  } else if (router === "pages") {
    if (normalized.includes("/pages/api/") || normalized.includes("/src/pages/api/")) {
      kind = "api";
    } else if (isPagesRouterNonRouteFile(baseName)) {
      kind = "unknown";
    } else {
      kind = "page";
    }
  }

  const routePath = router === "unknown" ? null : computeRoutePath(router, normalized);

  return { router, kind, routePath, isClientComponent, hasMetadata };
}

function computeRoutePath(router: "app" | "pages", normalizedFilePath: string): string | null {
  const parts = normalizedFilePath.split("/").filter(Boolean);
  const routerDir = router === "app" ? "app" : "pages";
  const idx = parts.lastIndexOf(routerDir);
  if (idx < 0) return null;

  const routeParts = parts.slice(idx + 1);
  if (routeParts.length === 0) return "/";

  const fileName = routeParts.pop();
  if (!fileName) return "/";

  const baseName = path.basename(fileName, path.extname(fileName));
  if (router === "pages" && isPagesRouterNonRouteFile(baseName)) {
    return null;
  }
  if (router === "pages" && baseName !== "index") {
    routeParts.push(baseName);
  }

  const cleaned = routeParts
    .filter((seg) => !seg.startsWith("(") && !seg.startsWith("@"))
    .map((seg) => (seg === "index" ? "" : seg))
    .filter((seg) => seg.length > 0);

  const route = "/" + cleaned.join("/");
  return route === "/" ? "/" : route.replace(/\/+/g, "/");
}

function hasUseClientDirective(content: string): boolean {
  // Must be a top-of-file directive.
  const match = content.match(/^\s*(['"])use client\1\s*;?/);
  return Boolean(match);
}

function isPagesRouterNonRouteFile(baseName: string): boolean {
  // These are framework-managed entrypoints, not route segments.
  // https://nextjs.org/docs/pages/building-your-application/routing/custom-app
  // https://nextjs.org/docs/pages/building-your-application/routing/custom-document
  // https://nextjs.org/docs/pages/building-your-application/routing/custom-error
  if (!baseName) return false;
  return baseName === "_app" || baseName === "_document" || baseName === "_error" || baseName === "_middleware";
}

async function detectNextRouterPresence(
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

async function tryLoadIndexStatistics(rootPath: string): Promise<CodebaseMetadata["statistics"]> {
  const base: CodebaseMetadata["statistics"] = {
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
  };

  try {
    const indexPath = path.join(rootPath, ".codebase-index.json");
    const stat = await fs.stat(indexPath);
    // Avoid blocking the event loop parsing very large index files.
    if (stat.size > 20 * 1024 * 1024) {
      return base;
    }
    const indexContent = await fs.readFile(indexPath, "utf-8");
    const chunks = (await parseJsonInWorker<any[]>(indexContent)) as any[];

    if (Array.isArray(chunks) && chunks.length > 0) {
      base.totalFiles = new Set(chunks.map((c: any) => c.filePath)).size;
      base.totalLines = chunks.reduce(
        (sum: number, c: any) => sum + (c.endLine - c.startLine + 1),
        0
      );
      for (const chunk of chunks) {
        if (chunk.componentType) {
          base.componentsByType[chunk.componentType] =
            (base.componentsByType[chunk.componentType] || 0) + 1;
          base.totalComponents++;
        }
        const layer = chunk.layer as unknown;
        if (isArchitecturalLayer(layer, base.componentsByLayer)) {
          base.componentsByLayer[layer] = (base.componentsByLayer[layer] || 0) + 1;
        }
      }
    }
  } catch {
    // Index doesn't exist yet
  }

  return base;
}

function isArchitecturalLayer(
  layer: unknown,
  layers: CodebaseMetadata["statistics"]["componentsByLayer"]
): layer is keyof typeof layers {
  return typeof layer === "string" && layer in layers;
}

function detectStateLibraries(allDeps: Record<string, string>): string[] {
  const state: string[] = [];
  if (allDeps["@reduxjs/toolkit"] || allDeps["redux"]) state.push("redux");
  if (allDeps["zustand"]) state.push("zustand");
  if (allDeps["jotai"]) state.push("jotai");
  if (allDeps["recoil"]) state.push("recoil");
  if (allDeps["mobx"]) state.push("mobx");
  return state;
}

function detectUiLibraries(allDeps: Record<string, string>): string[] {
  const ui: string[] = [];
  if (allDeps["tailwindcss"]) ui.push("Tailwind");
  if (allDeps["@mui/material"]) ui.push("MUI");
  if (allDeps["styled-components"]) ui.push("styled-components");
  if (allDeps["@radix-ui/react-slot"] || Object.keys(allDeps).some((d) => d.startsWith("@radix-ui/react-"))) {
    ui.push("Radix UI");
  }
  return ui;
}

function detectTestingLibraries(allDeps: Record<string, string>): string[] {
  const test: string[] = [];
  if (allDeps["vitest"]) test.push("Vitest");
  if (allDeps["jest"]) test.push("Jest");
  if (allDeps["@testing-library/react"]) test.push("Testing Library");
  if (allDeps["playwright"]) test.push("Playwright");
  if (allDeps["cypress"]) test.push("Cypress");
  return test;
}
