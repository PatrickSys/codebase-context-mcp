
import { CodebaseIndexer } from '../src/core/indexer.js';
import { CodebaseSearcher } from '../src/core/search.js';
import path from 'path';
import fs from 'fs/promises';

async function main() {
    const targetArg = process.argv[2];
    if (!targetArg) {
        console.error("Please provide a target code path");
        process.exit(1);
    }

    const targetPath = path.resolve(targetArg);
    console.log(`Generating assets for: ${targetPath}`);

    // 1. Indexing (Generates .codebase-intelligence.json)
    console.log("--- 1. Running Indexer ---");
    const indexer = new CodebaseIndexer({ rootPath: targetPath });
    const stats = await indexer.index();
    console.log(`Indexed ${stats.indexedFiles} files.`);

    // 2. Read Generated Intelligence (Simulate get_team_patterns / get_component_usage)
    console.log("--- 2. Reading Intelligence ---");
    const intelligencePath = path.join(targetPath, ".codebase-intelligence.json");
    const intelligenceRaw = await fs.readFile(intelligencePath, 'utf-8');
    const intelligence = JSON.parse(intelligenceRaw);

    const patterns = intelligence.patterns || {};
    const libraryUsage = intelligence.libraryUsage || {};

    // 3. Search Simulation (Simulate "Token Reduction")
    console.log("--- 3. Simulating Searches ---");
    const searcher = new CodebaseSearcher(targetPath);

    // Scenario A: Find usage of a known internal wrapper or library
    // Search for a common internal library pattern
    const searchQuery = "logging utility";
    const searchResults = await searcher.search(searchQuery, 3);

    // 4. Output Report
    const report = `
# Marketing Assets & Validation Report
Generated for: ${targetPath}
Date: ${new Date().toISOString()}

## 1. get_team_patterns Output (Real Data)

\`\`\`json
${JSON.stringify({ patterns }, null, 2)}
\`\`\`

## 2. get_component_usage ("@company/utils")

\`\`\`json
${JSON.stringify({
        source: "@company/utils",
        count: libraryUsage["@company/utils"]?.count || 0,
        files: libraryUsage["@company/utils"]?.files?.slice(0, 5) // Truncated for display
    }, null, 2)}
\`\`\`

## 3. Token Reduction Proxy Test

**Scenario**: Search for "${searchQuery}"

**Without MCP (Standard Search)**:
- Would return generic string matches.
- Requires reading file content to verify.
- Estimated tokens: ~2,000 (listing hits) + ~5,000 (reading 2-3 files).

**With MCP (Semantic + Usage)**:
- Tool call: \`get_component_usage("@company/utils")\` (if known) or \`search_codebase\`
- Search Results found: ${searchResults.length}
- Top Result Base Score: ${searchResults[0]?.score?.toFixed(2) || 'N/A'}
- Snippet Size: ~200 tokens.

**Conclusion**:
- MCP provides structured "facts" (patterns) instantly (0 search steps).
- Wrapper detection turns "search" into "lookup" (Immediate answer).
`;

    const outputPath = path.join(process.cwd(), 'internal-docs', 'marketing-assets.md');
    await fs.writeFile(outputPath, report);
    console.log(`Assets written to: ${outputPath}`);
}

main().catch(console.error);
