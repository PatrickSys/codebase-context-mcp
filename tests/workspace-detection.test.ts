import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
    scanWorkspacePackageJsons,
    detectWorkspaceType,
    aggregateWorkspaceDependencies,
    normalizePackageVersion,
} from '../src/utils/workspace-detection';

describe('workspace-detection', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('scanWorkspacePackageJsons', () => {
        it('should find root package.json', async () => {
            await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ name: 'root' })
            );
            const results = await scanWorkspacePackageJsons(tempDir);
            expect(results).toHaveLength(1);
            expect(results[0].name).toBe('root');
        });

        it('should find packages in apps/* and packages/*', async () => {
            await fs.mkdir(path.join(tempDir, 'apps', 'web'), { recursive: true });
            await fs.mkdir(path.join(tempDir, 'packages', 'ui'), { recursive: true });
            await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ name: 'root' })
            );
            await fs.writeFile(
                path.join(tempDir, 'apps', 'web', 'package.json'),
                JSON.stringify({ name: 'web', dependencies: { react: '^18.0.0' } })
            );
            await fs.writeFile(
                path.join(tempDir, 'packages', 'ui', 'package.json'),
                JSON.stringify({ name: 'ui' })
            );

            const results = await scanWorkspacePackageJsons(tempDir);
            expect(results).toHaveLength(3);
        });

        it('should find packages in libs/* (Nx convention)', async () => {
            await fs.mkdir(path.join(tempDir, 'libs', 'shared'), { recursive: true });
            await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ name: 'root' })
            );
            await fs.writeFile(
                path.join(tempDir, 'libs', 'shared', 'package.json'),
                JSON.stringify({ name: 'shared' })
            );

            const results = await scanWorkspacePackageJsons(tempDir);
            expect(results).toHaveLength(2);
            expect(results.some(r => r.name === 'shared')).toBe(true);
        });

        it('should skip invalid JSON files', async () => {
            await fs.writeFile(
                path.join(tempDir, 'package.json'),
                'not valid json'
            );
            const results = await scanWorkspacePackageJsons(tempDir);
            expect(results).toHaveLength(0);
        });
    });

    describe('detectWorkspaceType', () => {
        it('should detect Nx via nx.json', async () => {
            await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
            await fs.writeFile(path.join(tempDir, 'nx.json'), '{}');
            expect(await detectWorkspaceType(tempDir)).toBe('nx');
        });

        it('should detect Nx via @nx/* dependency', async () => {
            await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ devDependencies: { '@nx/workspace': '^17.0.0' } })
            );
            expect(await detectWorkspaceType(tempDir)).toBe('nx');
        });

        it('should detect Nx via @nrwl/* dependency (legacy)', async () => {
            await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ devDependencies: { '@nrwl/workspace': '^15.0.0' } })
            );
            expect(await detectWorkspaceType(tempDir)).toBe('nx');
        });

        it('should detect Turborepo via turbo.json', async () => {
            await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
            await fs.writeFile(path.join(tempDir, 'turbo.json'), '{}');
            expect(await detectWorkspaceType(tempDir)).toBe('turborepo');
        });

        it('should detect Lerna via lerna.json', async () => {
            await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
            await fs.writeFile(path.join(tempDir, 'lerna.json'), '{}');
            expect(await detectWorkspaceType(tempDir)).toBe('lerna');
        });

        it('should detect pnpm via pnpm-workspace.yaml', async () => {
            await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
            await fs.writeFile(path.join(tempDir, 'pnpm-workspace.yaml'), '');
            expect(await detectWorkspaceType(tempDir)).toBe('pnpm');
        });

        it('should detect npm workspaces when multiple package.json files exist', async () => {
            await fs.mkdir(path.join(tempDir, 'packages', 'a'), { recursive: true });
            await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
            await fs.writeFile(path.join(tempDir, 'packages', 'a', 'package.json'), '{}');
            expect(await detectWorkspaceType(tempDir)).toBe('npm');
        });

        it('should return single for non-monorepo', async () => {
            await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
            expect(await detectWorkspaceType(tempDir)).toBe('single');
        });
    });

    describe('aggregateWorkspaceDependencies', () => {
        it('should merge dependencies from all packages', () => {
            const packages = [
                { filePath: '/root/package.json', dependencies: { react: '^18.0.0' } },
                { filePath: '/root/apps/web/package.json', devDependencies: { typescript: '^5.0.0' } },
                { filePath: '/root/packages/ui/package.json', peerDependencies: { react: '^18.0.0' } },
            ];
            const result = aggregateWorkspaceDependencies(packages);
            expect(result).toEqual({
                react: '^18.0.0',
                typescript: '^5.0.0',
            });
        });

        it('should handle empty packages', () => {
            const result = aggregateWorkspaceDependencies([]);
            expect(result).toEqual({});
        });
    });

    describe('normalizePackageVersion', () => {
        it('should strip ^ prefix', () => {
            expect(normalizePackageVersion('^1.2.3')).toBe('1.2.3');
        });

        it('should strip ~ prefix', () => {
            expect(normalizePackageVersion('~1.2.3')).toBe('1.2.3');
        });

        it('should leave exact versions unchanged', () => {
            expect(normalizePackageVersion('1.2.3')).toBe('1.2.3');
        });

        it('should handle undefined', () => {
            expect(normalizePackageVersion(undefined)).toBeUndefined();
        });
    });
});
