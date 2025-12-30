import { promises as fs } from "fs";
import path from "path";
import { glob } from "glob";

export interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface PackageJsonWithPath {
  filePath: string;
  packageJson: PackageJson;
}

export type DetectedFramework = "angular" | "react" | "nextjs";

export interface DetectedEcosystem {
  frameworks: DetectedFramework[];
  primaryFramework: DetectedFramework | null;
  frameworkVersions: Partial<Record<DetectedFramework, string>>;
  hasTypeScript: boolean;
  hasNx: boolean;
  libraries: {
    forms: string[];
    validation: string[];
    state: string[];
    data: string[];
    styling: string[];
  };
}

export function normalizePackageVersion(version: string | undefined): string | undefined {
  if (!version) return undefined;
  return version.replace(/^[~^]/, "");
}

export function getPackageName(importSource: string): string {
  if (importSource.startsWith("@")) {
    const [scope, name] = importSource.split("/");
    return name ? `${scope}/${name}` : importSource;
  }
  return importSource.split("/")[0] || importSource;
}

export function mergeDependencies(packageJson: PackageJson): Record<string, string> {
  return {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
    ...(packageJson.peerDependencies || {}),
  };
}

export async function readPackageJson(filePath: string): Promise<PackageJson> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as PackageJson;
}

export async function readRootPackageJson(rootPath: string): Promise<PackageJsonWithPath | null> {
  const packageJsonPath = path.join(rootPath, "package.json");
  try {
    const packageJson = await readPackageJson(packageJsonPath);
    return { filePath: packageJsonPath, packageJson };
  } catch {
    return null;
  }
}

export async function scanWorkspacePackageJsons(rootPath: string): Promise<PackageJsonWithPath[]> {
  const matches = await glob(["package.json", "apps/*/package.json", "packages/*/package.json"], {
    cwd: rootPath,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    nodir: true,
  });

  const uniquePaths = Array.from(new Set(matches));
  const results: PackageJsonWithPath[] = [];

  for (const filePath of uniquePaths) {
    try {
      results.push({ filePath, packageJson: await readPackageJson(filePath) });
    } catch {
      // Ignore unreadable package.json files
    }
  }

  return results;
}

function hasAnyDependency(allDeps: Record<string, string>, names: string[]): boolean {
  return names.some((n) => Boolean(allDeps[n]));
}

export function detectEcosystemFromPackageJsons(
  packageJsons: PackageJsonWithPath[]
): DetectedEcosystem {
  const allDeps: Record<string, string> = {};
  for (const { packageJson } of packageJsons) {
    Object.assign(allDeps, mergeDependencies(packageJson));
  }

  const hasAngular = Boolean(allDeps["@angular/core"]);
  const hasNext = Boolean(allDeps["next"]);
  const hasReact = Boolean(allDeps["react"]);

  const frameworks: DetectedFramework[] = [];
  if (hasAngular) frameworks.push("angular");
  if (hasNext) frameworks.push("nextjs");
  if (hasReact) frameworks.push("react");

  const primaryFramework: DetectedFramework | null = hasNext
    ? "nextjs"
    : hasAngular
      ? "angular"
      : hasReact
        ? "react"
        : null;

  const frameworkVersions: Partial<Record<DetectedFramework, string>> = {
    angular: normalizePackageVersion(allDeps["@angular/core"]),
    nextjs: normalizePackageVersion(allDeps["next"]),
    react: normalizePackageVersion(allDeps["react"]),
  };

  const hasTypeScript = Boolean(allDeps["typescript"]);

  const hasNx = maybeDetectNx(allDeps);

  const libraries = {
    forms: detectLibraries(allDeps, ["react-hook-form", "formik", "final-form", "@tanstack/react-form"]),
    validation: detectLibraries(allDeps, ["zod", "yup", "joi", "valibot"]),
    state: detectLibraries(allDeps, ["@reduxjs/toolkit", "redux", "zustand", "jotai", "recoil", "mobx"]),
    data: detectLibraries(allDeps, ["@tanstack/react-query", "@apollo/client", "swr", "urql"]),
    styling: detectLibraries(allDeps, ["tailwindcss", "@mui/material", "styled-components", "@emotion/react", "class-variance-authority", "@radix-ui/react-slot"]),
  };

  return {
    frameworks,
    primaryFramework,
    frameworkVersions,
    hasTypeScript,
    hasNx,
    libraries,
  };
}

function detectLibraries(allDeps: Record<string, string>, candidates: string[]): string[] {
  return candidates.filter((pkg) => Boolean(allDeps[pkg]));
}

function maybeDetectNx(allDeps: Record<string, string>): boolean {
  // Nx can be indicated by nx.json, workspace.json, or @nx/* deps. We keep it light and dependency-based.
  if (Boolean(allDeps["nx"])) return true;
  if (Object.keys(allDeps).some((name) => name.startsWith("@nx/"))) return true;
  if (Object.keys(allDeps).some((name) => name.startsWith("@nrwl/"))) return true;
  return false;
}
