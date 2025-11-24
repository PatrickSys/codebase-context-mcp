/**
 * Quick test script for the indexer
 */

import { CodebaseIndexer } from './dist/core/indexer.js';
import { analyzerRegistry } from './dist/core/analyzer-registry.js';
import { AngularAnalyzer } from './dist/analyzers/angular/index.js';
import { GenericAnalyzer } from './dist/analyzers/generic/index.js';

// Register analyzers
analyzerRegistry.register(new AngularAnalyzer());
analyzerRegistry.register(new GenericAnalyzer());

const SSP_PORTAL_PATH = 'C:\\Users\\patrick.colom\\Repos\\SSP_Portal';

async function main() {
  console.log('Starting indexing test on SSP_Portal...');
  console.log(`Path: ${SSP_PORTAL_PATH}`);

  const indexer = new CodebaseIndexer({
    rootPath: SSP_PORTAL_PATH,
    onProgress: (progress) => {
      if (progress.percentage % 10 === 0) {
        console.log(`[${progress.phase}] ${progress.percentage}%`);
      }
    },
  });

  try {
    const stats = await indexer.index();

    console.log('\n=== Indexing Complete ===');
    console.log(`Total files: ${stats.totalFiles}`);
    console.log(`Indexed files: ${stats.indexedFiles}`);
    console.log(`Total chunks: ${stats.totalChunks}`);
    console.log(`Duration: ${(stats.duration / 1000).toFixed(2)}s`);
    console.log('\nComponents by type:', stats.componentsByType);
    console.log('Components by layer:', stats.componentsByLayer);

    if (stats.errors.length > 0) {
      console.log(`\nErrors: ${stats.errors.length}`);
      stats.errors.slice(0, 5).forEach(err => {
        console.log(`  - ${err.filePath}: ${err.error}`);
      });
    }
  } catch (error) {
    console.error('Indexing failed:', error);
  }
}

main();
