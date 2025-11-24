#!/usr/bin/env node

/**
 * Test script to validate search result quality
 * Tests the new summary + snippet format
 */

import { CodebaseSearcher } from './dist/core/search.js';
import { CodebaseIndexer } from './dist/core/indexer.js';
import { analyzerRegistry } from './dist/core/analyzer-registry.js';
import { AngularAnalyzer } from './dist/analyzers/angular/index.js';
import { GenericAnalyzer } from './dist/analyzers/generic/index.js';
import path from 'path';
import { promises as fs } from 'fs';

// Register analyzers
analyzerRegistry.register(new AngularAnalyzer());
analyzerRegistry.register(new GenericAnalyzer());

const SSP_PATH = 'C:\\Users\\patrick.colom\\Repos\\SSP_Portal';

/**
 * Validate search result format and quality
 */
async function validateSearchResults() {
  console.log('=== Search Quality Validation ===\n');

  // Check if index exists
  const indexPath = path.join(SSP_PATH, '.codebase-index.json');
  try {
    await fs.access(indexPath);
    console.log('✓ Index found\n');
  } catch {
    console.log('✗ Index not found. Run indexer first.\n');
    process.exit(1);
  }

  const searcher = new CodebaseSearcher(SSP_PATH);
  await searcher.initialize();

  // Test queries that should return Angular-specific results
  const testQueries = [
    { query: 'auth guard', expectedType: 'guard' },
    { query: 'user service', expectedType: 'service' },
    { query: 'angular component lifecycle hooks', expectedType: 'component' },
    { query: 'data table', expectedType: 'component' },
  ];

  for (const { query, expectedType } of testQueries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Query: "${query}"`);
    console.log(`Expected type: ${expectedType}`);
    console.log('='.repeat(60));

    const results = await searcher.search(query, 3);

    if (results.length === 0) {
      console.log('✗ No results found\n');
      continue;
    }

    console.log(`\n✓ Found ${results.length} results\n`);

    results.forEach((result, i) => {
      console.log(`--- Result ${i + 1} (score: ${result.score.toFixed(3)}) ---`);

      // Validate format
      const hasRequiredFields = result.summary && result.snippet && result.filePath;
      console.log(`Format valid: ${hasRequiredFields ? '✓' : '✗'}`);

      // Count words in snippet
      const wordCount = result.snippet.split(/\s+/).length;
      const withinLimit = wordCount <= 520; // 500 + small buffer for truncation message
      console.log(`Word count: ${wordCount} ${withinLimit ? '✓' : '✗ EXCEEDS LIMIT'}`);

      // Check if summary is concise
      const summaryWords = result.summary.split(/\s+/).length;
      const summaryConcise = summaryWords <= 50; // Should be 1-2 sentences
      console.log(`Summary length: ${summaryWords} words ${summaryConcise ? '✓' : '✗ TOO LONG'}`);

      // Display summary
      console.log(`\nSummary:\n  ${result.summary}`);

      // Display file reference
      console.log(`\nFile: ${result.filePath}:${result.startLine}-${result.endLine}`);

      // Display metadata
      if (result.componentType) {
        console.log(`Type: ${result.componentType} ${result.componentType === expectedType ? '✓' : ''}`);
      }
      if (result.framework) {
        console.log(`Framework: ${result.framework}`);
      }
      if (result.layer) {
        console.log(`Layer: ${result.layer}`);
      }
      if (result.relevanceReason) {
        console.log(`Relevance: ${result.relevanceReason}`);
      }

      // Show snippet preview (first 200 chars)
      console.log(`\nSnippet preview:\n${result.snippet.substring(0, 200)}...`);

      console.log('');
    });
  }

  // Summary statistics
  console.log('\n' + '='.repeat(60));
  console.log('Summary Statistics');
  console.log('='.repeat(60));

  const chunkCount = await searcher.getChunkCount();
  console.log(`Total indexed chunks: ${chunkCount}`);
  console.log(`Searcher status: ${searcher.isReady() ? 'ready ✓' : 'not ready ✗'}`);
}

/**
 * Test search performance
 */
async function testSearchPerformance() {
  console.log('\n\n=== Search Performance Test ===\n');

  const searcher = new CodebaseSearcher(SSP_PATH);
  await searcher.initialize();

  const queries = [
    'authentication',
    'data service http',
    'angular component',
    'routing guards',
    'form validation',
  ];

  const timings = [];

  for (const query of queries) {
    const start = Date.now();
    const results = await searcher.search(query, 10);
    const duration = Date.now() - start;

    timings.push(duration);

    const status = duration < 500 ? '✓' : '✗ SLOW';
    console.log(`"${query}": ${duration}ms (${results.length} results) ${status}`);
  }

  const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
  const maxTime = Math.max(...timings);

  console.log(`\nAverage: ${avgTime.toFixed(0)}ms`);
  console.log(`Max: ${maxTime}ms`);
  console.log(`Target: <500ms ${avgTime < 500 ? '✓' : '✗'}`);
}

// Run tests
async function main() {
  try {
    await validateSearchResults();
    await testSearchPerformance();

    console.log('\n\n✓ All tests complete\n');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  }
}

main();
