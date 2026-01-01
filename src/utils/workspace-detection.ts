/**
 * Workspace Detection Utilities
 * 
 * Scans monorepo workspace structures and detects ecosystem configuration.
 * Supports Nx, Turborepo, Lerna, pnpm, and npm workspaces.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

export interface WorkspacePackageJson {
    filePath: string;
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}

export type WorkspaceType = 'nx' | 'turborepo' | 'lerna' | 'pnpm' | 'npm' | 'single';

/**
 * Scan for package.json files in common monorepo locations.
 * Handles Nx, Turborepo, Lerna, and pnpm workspace structures.
 */
export async function scanWorkspacePackageJsons(rootPath: string): Promise<WorkspacePackageJson[]> {
    const patterns = [
        'package.json',
        'apps/*/package.json',
        'packages/*/package.json',
        'libs/*/package.json',  // Nx convention
    ];

    const matches = await glob(patterns, {
        cwd: rootPath,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        nodir: true,
    });

    const results: WorkspacePackageJson[] = [];
    for (const filePath of [...new Set(matches)]) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const pkg = JSON.parse(content);
            results.push({
                filePath,
                name: pkg.name,
                dependencies: pkg.dependencies,
                devDependencies: pkg.devDependencies,
                peerDependencies: pkg.peerDependencies,
            });
        } catch {
            // skip
        }
    }
    return results;
}

/**
 * Detect the workspace/monorepo type based on config files and dependencies.
 */
export async function detectWorkspaceType(rootPath: string): Promise<WorkspaceType> {
    // Check for config files
    const checks = [
        { file: 'nx.json', type: 'nx' as WorkspaceType },
        { file: 'turbo.json', type: 'turborepo' as WorkspaceType },
        { file: 'lerna.json', type: 'lerna' as WorkspaceType },
        { file: 'pnpm-workspace.yaml', type: 'pnpm' as WorkspaceType },
    ];

    for (const { file, type } of checks) {
        try {
            await fs.access(path.join(rootPath, file));
            return type;
        } catch {
            // not found
        }
    }

    // Check for Nx via dependencies
    try {
        const pkgPath = path.join(rootPath, 'package.json');
        const content = await fs.readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(content);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (allDeps['nx'] || Object.keys(allDeps).some(d => d.startsWith('@nx/') || d.startsWith('@nrwl/'))) {
            return 'nx';
        }
    } catch {
        // no package.json
    }

    // Check if there are multiple package.json files (npm workspaces)
    const packages = await scanWorkspacePackageJsons(rootPath);
    if (packages.length > 1) {
        return 'npm';
    }

    return 'single';
}

/**
 * Aggregate dependencies from all workspace packages.
 */
export function aggregateWorkspaceDependencies(
    packages: WorkspacePackageJson[]
): Record<string, string> {
    const allDeps: Record<string, string> = {};
    for (const pkg of packages) {
        Object.assign(allDeps, pkg.dependencies || {});
        Object.assign(allDeps, pkg.devDependencies || {});
        Object.assign(allDeps, pkg.peerDependencies || {});
    }
    return allDeps;
}

/**
 * Normalize package version by stripping ^ and ~ prefixes.
 */
export function normalizePackageVersion(version: string | undefined): string | undefined {
    if (!version) return undefined;
    return version.replace(/^[~^]/, '');
}
