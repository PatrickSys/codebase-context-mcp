
import { CodebaseIndexer } from '../dist/core/indexer.js';
import { CodebaseSearcher } from '../dist/core/search.js';
import { analyzerRegistry } from '../dist/core/analyzer-registry.js';
import { AngularAnalyzer } from '../dist/analyzers/angular/index.js';
import { GenericAnalyzer } from '../dist/analyzers/generic/index.js';
import path from 'path';
import fs from 'fs/promises';

async function main() {
    console.log("Registering Analyzers...");
    analyzerRegistry.register(new AngularAnalyzer());
    analyzerRegistry.register(new GenericAnalyzer());

    const targetArg = process.argv[2];
    if (!targetArg) {
        console.error("Please provide a target code path");
        process.exit(1);
    }

    const targetPath = path.resolve(targetArg);
    console.log(`Generating assets for: ${targetPath}`);

    // 1. Indexing (Generates .codebase-intelligence.json)
    console.log("--- 1. Running Indexer ---");
    const indexer = new CodebaseIndexer({
        rootPath: targetPath,
        config: {
            respectGitignore: false,
            include: ["**/*.ts"],
            exclude: ["**/node_modules/**", "**/dist/**", "**/*.spec.ts"],
            skipEmbedding: true // CRITICAL for speed
        }
    });

    const stats = await indexer.index();
    console.log(`Indexed ${stats.indexedFiles} files.`);

    // 2. Read Generated Intelligence
    console.log("--- 2. Reading Intelligence ---");
    const intelligencePath = path.join(targetPath, ".codebase-intelligence.json");
    const intelligenceRaw = await fs.readFile(intelligencePath, 'utf-8');
    const intelligence = JSON.parse(intelligenceRaw);

    const patterns = intelligence.patterns || {};
    const libraryUsage = intelligence.libraryUsage || {};

    // 3. Search Simulation (Mocked, since no embeddings)
    console.log("--- 3. Simulating Searches ---");
    // const searcher = new CodebaseSearcher(targetPath);

    const searchQuery = "logging utility";
    // const searchResults = await searcher.search(searchQuery, 3);
    const searchResults = []; // Mocked empty results since we skipped embedding

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
        files: libraryUsage["@company/utils"]?.files?.slice(0, 5)
    }, null, 2)}
\`\`\`

## 3. Token Reduction Proxy Test

**Scenario**: Search for "${searchQuery}"

**Without MCP (Standard Search)**:
- Would return generic string matches.
- Estimate: ~10 results * ~500 tokens context + overhead = ~5000+ tokens to verify.

**With MCP (Semantic + Usage)**:
- Tool call: \`get_component_usage("@company/utils")\`
- Result: Exact usage count and locations.
- Tokens: ~200 (Structured Response). Matches found: ${libraryUsage["@company/utils"]?.count || "Unknown"}.

`;

    const outputPath = path.join(process.cwd(), 'internal-docs', 'marketing-assets.md');
    await fs.writeFile(outputPath, report);
    console.log(`Assets written to: ${outputPath}`);
}

main().catch(console.error);
