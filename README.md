# Codebase Context MCP

An MCP server that gives AI agents actual understanding of your codebase - not just search, but awareness of your patterns, libraries, and conventions.

## The Problem

I've used pretty much every AI coding tool at this point - Cursor, Claude Code, Copilot, Gemini CLI, Codex. They all have some form of semantic search now. But that's not the real issue.

The problem is they don't _know_ your codebase. They don't act like a team member.

At work, I have an Angular monorepo with 600+ files. We use CodeBlue (our internal design system built on PrimeNG), RxJS for state, Syncfusion for grids, Jest with specific mocking patterns. When I ask an AI to write a unit test, it:

- Uses testing patterns we don't follow
- Mocks things in ways that don't match our existing tests
- Suggests Material components when we use PrimeNG
- Ignores our state management patterns
- Doesn't know about the component library we actually use

The AI is smart, but it's generic. It doesn't know _your_ codebase.

## What This Does

This MCP server indexes your codebase and exposes context to AI agents so they can:

- **Know your stack** - Detects your frameworks, UI libraries, testing setup
- **Learn your patterns** - Understands how you structure code, which architectural layers you use
- **Find relevant examples** - Semantic search that finds similar implementations in _your_ code
- **Follow your conventions** - Surfaces style guides, CONTRIBUTING.md, and team standards

Runs 100% locally. No API keys, no cloud. Works with Claude Code, Cursor, Gemini CLI, anything that supports MCP.

## Quick Start

### Option 1: Install from npm (Recommended)

```bash
npm install -g codebase-context-mcp
```

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "codebase-context": {
      "type": "stdio",
      "command": "codebase-context",
      "args": ["/path/to/your/project"]
    }
  }
}
```

Or use `npx` without installing:

```json
{
  "mcpServers": {
    "codebase-context": {
      "type": "stdio",
      "command": "npx",
      "args": ["codebase-context-mcp", "/path/to/your/project"]
    }
  }
}
```

### Option 2: Build from Source

```bash
git clone https://github.com/PatrickSys/codebase-context-mcp.git
cd codebase-context-mcp
npm install
npm run build
```

Then add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "codebase-context": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/codebase-context-mcp/dist/index.js",
        "/path/to/your/project"
      ]
    }
  }
}
```

It indexes automatically on first run. After that, the AI has real context about your codebase.

So when you ask:

- "Write a unit test for this service" → It uses your existing mocking patterns, not random ones
- "Add a dropdown component" → It knows you use PrimeNG/CodeBlue, not Material
- "Handle this API error" → It finds how you already handle errors and follows that pattern
- "Add state management here" → It uses RxJS/signals the way your team does

The AI stops being a generic assistant and starts acting like someone who's worked on your codebase.

## How It Works

1. **Indexes your codebase** on startup using local embeddings (Transformers.js with BGE model)
2. **Stores vectors** in LanceDB (embedded, no server needed)
3. **Hybrid search** combines semantic similarity with keyword matching
4. **Angular analyzer** extracts component types, architectural layers, patterns

For Angular projects specifically, it understands:

- **Your architecture** - What layer each file belongs to (presentation, business, data, core)
- **Your patterns** - Whether you use signals, inject(), standalone components, OnPush
- **Your testing style** - How you structure tests and mock dependencies
- **Your UI library** - PrimeNG, Material, Syncfusion, custom components

## Available Tools

| Tool                    | What it does                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `search_codebase`       | Find similar code in your codebase - "how do we test services?", "how do we use grids?" |
| `get_codebase_metadata` | Stack info - frameworks, UI libs, testing setup, architecture patterns                  |
| `get_style_guide`       | Team conventions from CONTRIBUTING.md, AGENTS.md, style guides                          |
| `get_indexing_status`   | Check if index is ready                                                                 |

## Requirements

- Node.js 18+
- ~130MB for the embedding model (downloads automatically on first run)
- ~500MB RAM while indexing

## Programmatic Usage

You can also use the indexer and searcher as a library:

```typescript
import {
  CodebaseIndexer,
  CodebaseSearcher,
  analyzerRegistry,
  AngularAnalyzer,
  GenericAnalyzer,
} from "codebase-context-mcp";

// Register analyzers
analyzerRegistry.register(new AngularAnalyzer());
analyzerRegistry.register(new GenericAnalyzer());

// Index a codebase
const indexer = new CodebaseIndexer({ rootPath: "/path/to/project" });
const stats = await indexer.index();

// Search
const searcher = new CodebaseSearcher("/path/to/project");
const results = await searcher.search("authentication guards");
```

Or use the convenience functions:

```typescript
import { createIndexer, createSearcher } from "codebase-context-mcp";

const indexer = createIndexer("/path/to/project");
await indexer.index();

const searcher = createSearcher("/path/to/project");
const results = await searcher.search("how do we handle errors?");
```

## Current State

v1.0 - I've been using this on an Angular monorepo at work. The difference is noticeable: the AI writes tests that actually match our patterns, suggests components from our library, follows our conventions.

**What works:**

- Codebase awareness (patterns, libraries, architecture)
- Semantic search for finding similar implementations
- Style guide/convention detection
- Angular-specific analysis
- Fully local, no API keys

**What's next:**

- Incremental indexing (currently re-indexes on restart)
- React/Vue support

## Why Not Just Use X?

|                      | Cursor   | Claude Code | Copilot  | This     |
| -------------------- | -------- | ----------- | -------- | -------- |
| Semantic search      | ✅       | ✅          | ✅       | ✅       |
| Knows your patterns  | ❌       | ❌          | ❌       | ✅       |
| Knows your libraries | ❌       | ❌          | ❌       | ✅       |
| Style guide aware    | ❌       | ❌          | ❌       | ✅       |
| Privacy              | ☁️ cloud | 💻 local    | ☁️ cloud | 💻 local |

Most AI tools have decent search now. What they lack is _understanding_ - they don't know that you use PrimeNG not Material, Jest not Vitest, RxJS not Redux.

## Contributing

PRs welcome. The main things that would help:

- React analyzer (biggest gap right now)
- Vue analyzer
- Better search ranking algorithms
- Tests

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions.

## License

MIT
