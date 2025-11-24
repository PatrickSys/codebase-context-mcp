import { CodebaseSearcher } from './dist/core/search.js';

const SSP_PORTAL_PATH = 'C:\\Users\\patrick.colom\\Repos\\SSP_Portal';

async function testSearch() {
  console.log('Testing search functionality on SSP_Portal...\n');

  const searcher = new CodebaseSearcher(SSP_PORTAL_PATH);
  await searcher.initialize();

  const queries = [
    'Angular components',
    'authentication service',
    'NgRx store',
  ];

  for (const query of queries) {
    console.log(`\nQuery: "${query}"`);
    console.log('='.repeat(50));

    const results = await searcher.search(query, 3);

    if (results.length === 0) {
      console.log('No results found');
      continue;
    }

    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.summary}`);
      console.log(`   File: ${result.filePath}:${result.startLine}-${result.endLine}`);
      console.log(`   Score: ${result.score.toFixed(3)}`);
      console.log(`   Reason: ${result.relevanceReason}`);
      if (result.componentType) {
        console.log(`   Type: ${result.componentType}`);
      }
      if (result.layer) {
        console.log(`   Layer: ${result.layer}`);
      }
    });
  }

  console.log('\n' + '='.repeat(50));
  console.log('Search test complete');
}

testSearch().catch(console.error);
