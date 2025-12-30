/**
 * React Analyzer - Framework-aware analysis for React projects.
 *
 * Detects:
 * - Function/class components
 * - Hook usage and custom hooks
 * - Context creation and usage
 * - Memoization and Suspense patterns
 *
 * No runtime execution: filesystem + AST only.
 */

import path from "path";
import {
  FrameworkAnalyzer,
  AnalysisResult,
  CodebaseMetadata,
  CodeChunk,
  CodeComponent,
  ImportStatement,
  ExportStatement,
  Dependency,
} from "../../types/index.js";
import { parse } from "@typescript-eslint/typescript-estree";
import { createChunksFromCode } from "../../utils/chunking.js";
import { parseJsonInWorker } from "../../utils/async-json.js";
import {
  getPackageName,
  mergeDependencies,
  normalizePackageVersion,
  readRootPackageJson,
} from "../orchestration/package-json.js";
import { promises as fs } from "fs";

type DetectedPattern = { category: string; name: string };

const BUILTIN_HOOKS = new Set([
  "useState",
  "useEffect",
  "useMemo",
  "useCallback",
  "useReducer",
  "useRef",
  "useContext",
  "useLayoutEffect",
  "useImperativeHandle",
  "useDebugValue",
  "useDeferredValue",
  "useTransition",
  "useId",
  "useSyncExternalStore",
  "useInsertionEffect",
]);

export class ReactAnalyzer implements FrameworkAnalyzer {
  readonly name = "react";
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
  readonly priority = 80;

  canAnalyze(filePath: string, content?: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (!this.supportedExtensions.includes(ext)) return false;

    // TSX/JSX are overwhelmingly React in practice.
    if (ext === ".tsx" || ext === ".jsx") return true;

    if (!content) return false;

    // Heuristics for .ts/.js (non-JSX extensions)
    if (/\bfrom\s+["']react["']/.test(content)) return true;
    if (/\brequire\(\s*["']react["']\s*\)/.test(content)) return true;
    if (/\bReact\.createElement\b/.test(content)) return true;

    // JSX without .tsx/.jsx (rare but possible with tooling)
    if (/<[A-Za-z][^>]*>/.test(content)) return true;

    return false;
  }

  async analyze(filePath: string, content: string): Promise<AnalysisResult> {
    const ext = path.extname(filePath).toLowerCase();
    const isJsx = ext.includes("x");
    const language = ext === ".ts" || ext === ".tsx" || ext === ".mts" || ext === ".cts"
      ? "typescript"
      : "javascript";
    const relativePath = path.relative(process.cwd(), filePath);

    const components: CodeComponent[] = [];
    const imports: ImportStatement[] = [];
    const exports: ExportStatement[] = [];
    const dependencies: string[] = [];

    const detectedPatterns: DetectedPattern[] = [];

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

      const analysis = analyzeReactAst(ast);

      // Components / hooks
      for (const component of analysis.components) {
        components.push(component);
      }

      // Patterns
      if (analysis.usesContext) {
        detectedPatterns.push({ category: "stateManagement", name: "React Context" });
      }
      if (analysis.usesSuspense) {
        detectedPatterns.push({ category: "reactivity", name: "Suspense" });
      }
      if (analysis.usesMemoization) {
        detectedPatterns.push({ category: "reactivity", name: "Memoization" });
      }
      if (analysis.customHooks.length > 0) {
        detectedPatterns.push({ category: "reactHooks", name: "Custom hooks" });
      }
      if (analysis.builtinHooksUsed.length > 0) {
        detectedPatterns.push({ category: "reactHooks", name: "Built-in hooks" });
      }

      // Library-specific signals (Phase 4-6)
      if (analysis.importSources.has("react-hook-form")) {
        detectedPatterns.push({ category: "forms", name: "react-hook-form" });
      }
      if (analysis.importSources.has("zod")) {
        detectedPatterns.push({ category: "validation", name: "zod" });
      }
      if (analysis.importSources.has("@tanstack/react-query")) {
        detectedPatterns.push({ category: "data", name: "tanstack-query" });
      }
      if (analysis.importSources.has("@reduxjs/toolkit")) {
        detectedPatterns.push({ category: "stateManagement", name: "redux-toolkit" });
      }
      if (analysis.importSources.has("tailwindcss")) {
        detectedPatterns.push({ category: "styling", name: "tailwind" });
      }
    } catch (error) {
      console.warn(`Failed to parse React file ${filePath}:`, error);
    }

    const uniqueDependencies = Array.from(new Set(dependencies)).sort();

    const chunks = await createChunksFromCode(
      content,
      filePath,
      relativePath,
      language,
      components,
      {
        framework: "react",
        detectedPatterns,
      }
    );

    return {
      filePath,
      language,
      framework: "react",
      components,
      imports,
      exports,
      dependencies: uniqueDependencies.map((name) => ({
        name,
        category: this.categorizeDependency(name),
      })),
      metadata: {
        analyzer: this.name,
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

    const reactVersion = normalizePackageVersion(allDeps["react"]) || "unknown";

    const dependencies: Dependency[] = Object.entries(allDeps).map(([name, version]) => ({
      name,
      version: version as string,
      category: this.categorizeDependency(name),
    }));

    // Basic statistics from existing index if available (same pattern as Angular)
    const statistics = await tryLoadIndexStatistics(rootPath);

    return {
      name: projectName,
      rootPath,
      framework: {
        name: "React",
        version: reactVersion,
        type: "react",
        variant: "unknown",
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
      customMetadata: {},
    };
  }

  summarize(chunk: CodeChunk): string {
    const name = chunk.metadata?.componentName;
    const type = chunk.componentType;
    const fileName = path.basename(chunk.filePath);
    if (name && type) return `${name} (${type}) in ${fileName}.`;
    if (name) return `${name} in ${fileName}.`;
    return `React code in ${fileName}: lines ${chunk.startLine}-${chunk.endLine}.`;
  }

  private categorizeDependency(name: string): Dependency["category"] {
    if (name === "react" || name === "react-dom") return "framework";
    if (name === "next") return "framework";
    if (name.startsWith("@reduxjs/") || name === "redux" || name === "zustand") return "state";
    if (name === "@tanstack/react-query" || name === "swr" || name === "@apollo/client") return "http";
    if (name === "tailwindcss" || name === "@mui/material" || name === "styled-components") return "ui";
    if (name === "vitest" || name === "jest" || name === "@testing-library/react") return "testing";
    if (name === "typescript" || name === "eslint" || name === "vite") return "build";
    return "other";
  }
}

function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function isCustomHookName(name: string): boolean {
  return /^use[A-Z0-9]/.test(name);
}

function analyzeReactAst(ast: any): {
  components: CodeComponent[];
  builtinHooksUsed: string[];
  customHooks: string[];
  usesContext: boolean;
  usesMemoization: boolean;
  usesSuspense: boolean;
  importSources: Set<string>;
} {
  const components: CodeComponent[] = [];
  const builtinHooksUsed = new Set<string>();
  const customHooks = new Set<string>();
  const importSources = new Set<string>();

  // Collect import sources for library detection
  for (const node of ast.body as any[]) {
    if (node?.type === "ImportDeclaration" && typeof node.source?.value === "string") {
      importSources.add(getPackageName(node.source.value));
    }
  }

  let usesContext = false;
  let usesMemoization = false;
  let usesSuspense = false;

  walkAst(ast, (node, parent) => {
    if (!node || typeof node !== "object") return;

    // Hook usage
    if (node.type === "CallExpression") {
      const hookName = getCalleeName(node.callee);
      if (hookName) {
        if (BUILTIN_HOOKS.has(hookName)) builtinHooksUsed.add(hookName);
        if (hookName === "createContext" || hookName === "useContext") usesContext = true;
        if (hookName === "memo" || hookName === "useMemo" || hookName === "useCallback") {
          usesMemoization = true;
        }
        if (hookName === "lazy") {
          usesSuspense = true;
        }
      }

      // Context creation captured as variable name
      if (hookName === "createContext" && parent?.type === "VariableDeclarator" && parent.id?.type === "Identifier") {
        usesContext = true;
      }
    }

    // JSX Suspense detection
    if (node.type === "JSXElement" || node.type === "JSXFragment") {
      if (node.type === "JSXElement") {
        const tagName = getJsxTagName(node.openingElement?.name);
        if (tagName === "Suspense" || tagName === "React.Suspense") {
          usesSuspense = true;
        }
        if (tagName?.endsWith(".Provider") || tagName?.endsWith(".Consumer")) {
          usesContext = true;
        }
      }
    }

    // Component detection (functions, variables, classes)
    if (node.type === "FunctionDeclaration" && node.id?.name && node.loc) {
      const name = node.id.name as string;
      if (isCustomHookName(name)) {
        customHooks.add(name);
        components.push(toComponent(node, "function", "hook", { reactType: "custom-hook" }));
      } else if (isComponentName(name) && containsJsx(node)) {
        components.push(toComponent(node, "function", "component", { reactType: "function-component" }));
      }
    }

    if (node.type === "VariableDeclarator" && node.id?.type === "Identifier" && node.init && node.loc) {
      const name = node.id.name as string;
      if (node.init.type === "ArrowFunctionExpression" || node.init.type === "FunctionExpression") {
        if (isCustomHookName(name)) {
          customHooks.add(name);
          components.push(toComponent(node, "function", "hook", { reactType: "custom-hook" }));
        } else if (isComponentName(name) && containsJsx(node.init)) {
          components.push(toComponent(node, "function", "component", { reactType: "function-component" }));
        }
      }
    }

    if (node.type === "ClassDeclaration" && node.id?.name && node.loc) {
      const name = node.id.name as string;
      if (isComponentName(name) && isReactComponentSuperclass(node.superClass)) {
        components.push(toComponent(node, "class", "component", { reactType: "class-component" }));
      }
    }
  });

  return {
    components: dedupeComponents(components),
    builtinHooksUsed: Array.from(builtinHooksUsed).sort(),
    customHooks: Array.from(customHooks).sort(),
    usesContext,
    usesMemoization,
    usesSuspense,
    importSources,
  };
}

function dedupeComponents(components: CodeComponent[]): CodeComponent[] {
  const seen = new Set<string>();
  const result: CodeComponent[] = [];
  for (const c of components) {
    const key = `${c.name}:${c.startLine}:${c.endLine}:${c.componentType || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}

function toComponent(
  node: any,
  type: string,
  componentType: string,
  metadata: Record<string, any>
): CodeComponent {
  const startLine = node.loc?.start?.line ?? 1;
  const endLine = node.loc?.end?.line ?? startLine;

  const name =
    node.type === "VariableDeclarator" ? node.id?.name :
    node.id?.name || metadata?.name || "unknown";

  return {
    name,
    type,
    componentType,
    startLine,
    endLine,
    metadata,
  };
}

function getCalleeName(callee: any): string | null {
  if (!callee) return null;
  if (callee.type === "Identifier") return callee.name || null;
  if (callee.type === "MemberExpression") {
    const objectName = callee.object?.type === "Identifier" ? callee.object.name : null;
    const propName = callee.property?.type === "Identifier" ? callee.property.name : null;
    if (propName && objectName === "React") return propName;
    if (propName) return propName;
  }
  return null;
}

function getJsxTagName(nameNode: any): string | null {
  if (!nameNode) return null;
  if (nameNode.type === "JSXIdentifier") return nameNode.name || null;
  if (nameNode.type === "JSXMemberExpression") {
    const object = getJsxTagName(nameNode.object);
    const prop = getJsxTagName(nameNode.property);
    if (object && prop) return `${object}.${prop}`;
  }
  return null;
}

function isReactComponentSuperclass(superClass: any): boolean {
  if (!superClass) return false;
  if (superClass.type === "MemberExpression") {
    const objectName = superClass.object?.type === "Identifier" ? superClass.object.name : null;
    const propName = superClass.property?.type === "Identifier" ? superClass.property.name : null;
    return objectName === "React" && (propName === "Component" || propName === "PureComponent");
  }
  if (superClass.type === "Identifier") {
    return superClass.name === "Component" || superClass.name === "PureComponent";
  }
  return false;
}

function containsJsx(node: any): boolean {
  let found = false;
  walkAst(node, (n) => {
    if (found) return;
    if (n?.type === "JSXElement" || n?.type === "JSXFragment") found = true;
  });
  return found;
}

function walkAst(root: any, visitor: (node: any, parent: any | null) => void): void {
  const stack: Array<{ node: any; parent: any | null }> = [{ node: root, parent: null }];
  const seen = new Set<any>();

  while (stack.length > 0) {
    const { node, parent } = stack.pop()!;
    if (!node || typeof node !== "object") continue;
    if (seen.has(node)) continue;
    seen.add(node);

    visitor(node, parent);

    for (const value of Object.values(node)) {
      if (!value) continue;
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === "object") {
            stack.push({ node: child, parent: node });
          }
        }
      } else if (typeof value === "object") {
        stack.push({ node: value, parent: node });
      }
    }
  }
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
