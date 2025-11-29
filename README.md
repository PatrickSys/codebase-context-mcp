# Codebase Context MCP

I built this because Claude Code doesn't have semantic search. Cursor does, but it's cloud-based and you can't use it with Claude. So I made an MCP server that gives any AI assistant the ability to actually understand your codebase - not just grep through it.

## The Problem

When you ask Claude Code to "find authentication logic", it does a keyword search. If your auth guard is called `SessionGuard` and your service is `IdentityService`, it won't find them. You end up manually pointing the AI to files, which defeats the purpose.

## What This Does

- **Semantic search** - Finds code by meaning, not just text matching
- **Understands Angular** - Knows what a guard is, what a service does, which layer it belongs to
- **Runs locally** - No API keys, no cloud, your code stays on your machine
- **Works with any MCP client** - Claude Code, Cursor, Gemini CLI, whatever

## Quick Start

```bash
git clone https://github.com/PatrickSys/codebase-context-mcp.git
cd codebase-context-mcp
npm install
npm run build
```

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "codebase-context": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/codebase-context-mcp/dist/index.js"]
    }
  }
}
```

It indexes automatically on first run. After that, just ask naturally:

```
"Find the auth guards"
"Show me services in the data layer"
"Where do we handle HTTP errors?"
```

## How It Works

1. **Indexes your codebase** on startup using local embeddings (Transformers.js with BGE model)
2. **Stores vectors** in LanceDB (embedded, no server needed)
3. **Hybrid search** combines semantic similarity with keyword matching
4. **Angular analyzer** extracts component types, architectural layers, patterns

For Angular projects specifically, it detects:

- Component types (components, services, guards, interceptors, pipes, directives)
- Architectural layers (presentation, business, data, core, shared)
- Modern patterns (signals, `inject()`, `@if`/`@for` control flow)

## Available Tools

| Tool                    | What it does                                                         |
| ----------------------- | -------------------------------------------------------------------- |
| `search_codebase`       | Semantic search with optional filters by layer, component type, etc. |
| `get_codebase_metadata` | Framework info, dependencies, architecture stats                     |
| `get_style_guide`       | Finds relevant sections from CONTRIBUTING.md, style guides, etc.     |
| `get_indexing_status`   | Check if index is ready                                              |

## Requirements

- Node.js 18+
- ~130MB for the embedding model (downloads automatically on first run)
- ~500MB RAM while indexing

## Current State

This is v1.0 - it works, I use it daily on Angular monorepos with 600+ files.

**What's there:**

- Semantic + keyword hybrid search
- Angular-specific analysis with layer detection
- Local embeddings via Transformers.js (no API keys needed)
- LanceDB vector storage

**What's coming:**

- Incremental indexing (right now it re-indexes everything on restart)
- React/Vue analyzers
- Dependency graph analysis

## Why Not Just Use X?

|                   | Cursor @codebase | Claude Code  | This       |
| ----------------- | ---------------- | ------------ | ---------- |
| Semantic search   | ✅               | ❌ grep only | ✅         |
| Framework-aware   | ❌               | ❌           | ✅ Angular |
| Privacy           | ☁️ cloud         | 💻 local     | 💻 local   |
| Works with Claude | ❌               | ✅           | ✅         |

## Contributing

PRs welcome. The main things that would help:

- React analyzer (biggest gap right now)
- Vue analyzer
- Better search ranking algorithms
- Tests

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions.

## License

MIT
