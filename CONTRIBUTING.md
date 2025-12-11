# Contributing

## Setup

```bash
git clone https://github.com/PatrickSys/codebase-context.git
cd codebase-context
npm install
npm run build
```

## Using the Package

This is an MCP server, not a CLI tool. See [README.md](./README.md) for configuration with Claude Desktop, VS Code, Cursor, etc.

## Project Structure

```
src/
  analyzers/
    angular/     # Angular-specific analysis
    generic/     # Fallback for non-Angular files
  core/
    indexer.ts   # Scans files, creates chunks
    search.ts    # Hybrid semantic + keyword search
  embeddings/    # Transformers.js wrapper
  storage/       # LanceDB wrapper
  index.ts       # MCP server entry point
  lib.ts         # Library exports for programmatic use
```

## What Would Help

**React analyzer** - Biggest gap right now. Look at `src/analyzers/angular/index.ts` for the pattern. Needs to detect components, hooks, context usage, etc.

**Vue analyzer** - Same deal. Detect components, composables, Pinia stores.

**Better search ranking** - The hybrid search in `src/core/search.ts` could use tuning. Currently uses RRF to combine semantic and keyword scores.

**Tests** - There are none. Any test coverage would be an improvement.

## Adding a Framework Analyzer

1. Create `src/analyzers/react/index.ts`
2. Implement `FrameworkAnalyzer` interface
3. Register in `src/index.ts`

The interface is straightforward:

```typescript
interface FrameworkAnalyzer {
  name: string;
  canAnalyze(filePath: string, content?: string): boolean;
  analyze(filePath: string, content: string): Promise<AnalysisResult>;
  detectCodebaseMetadata(rootPath: string): Promise<CodebaseMetadata>;
}
```

## Running Locally

```bash
npm run build
node dist/index.js /path/to/test/project
```

The server logs to stderr, so you can see what it's doing.

## Pull Requests

- Fork, branch, make changes
- Run `npm run build` to make sure it compiles
- Test on an actual project
- Open PR with what you changed and why

No strict commit format, just be clear about what you're doing.
