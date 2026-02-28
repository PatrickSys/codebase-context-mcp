import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import { InternalFileGraph } from '../src/utils/usage-tracker.js';

describe('InternalFileGraph serialization', () => {
  it('round-trips importDetails and importedSymbols behavior', () => {
    const rootPath = path.join(os.tmpdir(), `ifg-${Date.now()}`);
    const graph = new InternalFileGraph(rootPath);

    const exportedFile = path.join(rootPath, 'src', 'exported.ts');
    const importingFile = path.join(rootPath, 'src', 'importer.ts');

    graph.trackExports(exportedFile, [{ name: 'Foo', type: 'function' }]);
    graph.trackImport(importingFile, exportedFile, 12, ['Foo']);

    const json = graph.toJSON();
    expect(json.importDetails).toBeDefined();

    const restored = InternalFileGraph.fromJSON(json, rootPath);
    const restoredJson = restored.toJSON();
    expect(restoredJson.importDetails).toEqual(json.importDetails);

    const unused = restored.findUnusedExports();
    expect(unused.length).toBe(0);
  });
});

