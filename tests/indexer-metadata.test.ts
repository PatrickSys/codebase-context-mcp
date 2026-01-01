import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { CodebaseIndexer } from '../src/core/indexer';

describe('CodebaseIndexer.detectMetadata', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'indexer-test-'));
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('metadata detection', () => {
        it('should detect project name from directory', async () => {
            await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ name: 'test-project', dependencies: {} })
            );

            const indexer = new CodebaseIndexer({ rootPath: tempDir });
            const metadata = await indexer.detectMetadata();

            expect(metadata.rootPath).toBe(tempDir);
            expect(metadata.name).toBe(path.basename(tempDir));
        });

        it('should merge metadata from multiple analyzers', async () => {
            await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify({
                    name: 'angular-project',
                    dependencies: {
                        '@angular/core': '^17.0.0',
                        '@angular/common': '^17.0.0',
                    },
                })
            );

            const indexer = new CodebaseIndexer({ rootPath: tempDir });
            const metadata = await indexer.detectMetadata();

            expect(metadata).toBeDefined();
            expect(metadata.architecture).toBeDefined();
            expect(metadata.architecture.layers).toBeDefined();
        });

        it('should handle projects without package.json', async () => {
            const indexer = new CodebaseIndexer({ rootPath: tempDir });
            const metadata = await indexer.detectMetadata();

            expect(metadata).toBeDefined();
            expect(metadata.rootPath).toBe(tempDir);
            expect(metadata.dependencies).toEqual([]);
        });

        it('should merge languages from all analyzers', async () => {
            await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ name: 'test' })
            );

            await fs.writeFile(
                path.join(tempDir, 'app.ts'),
                'export const app = "test";'
            );

            const indexer = new CodebaseIndexer({ rootPath: tempDir });
            const metadata = await indexer.detectMetadata();

            expect(Array.isArray(metadata.languages)).toBe(true);
        });
    });

    describe('merge behavior', () => {
        it('should deduplicate merged arrays', async () => {
            await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ name: 'test' })
            );

            const indexer = new CodebaseIndexer({ rootPath: tempDir });
            const metadata = await indexer.detectMetadata();

            const uniqueStyleGuides = [...new Set(metadata.styleGuides)];
            expect(metadata.styleGuides.length).toBe(uniqueStyleGuides.length);
        });

        it('should preserve customMetadata from analyzers', async () => {
            await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ name: 'test' })
            );

            const indexer = new CodebaseIndexer({ rootPath: tempDir });
            const metadata = await indexer.detectMetadata();

            expect(metadata.customMetadata).toBeDefined();
            expect(typeof metadata.customMetadata).toBe('object');
        });
    });
});
