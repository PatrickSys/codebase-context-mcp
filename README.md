# codebase-context

## Local-first second brain for AI Agents working on your codebase

[![npm version](https://img.shields.io/npm/v/codebase-context)](https://www.npmjs.com/package/codebase-context) [![license](https://img.shields.io/npm/l/codebase-context)](./LICENSE) [![node](https://img.shields.io/node/v/codebase-context)](./package.json)

You're tired of AI agents writing code that 'just works' but fits like a square peg in a round hole - not your conventions, not your architecture, not your repo. Even with well-curated instructions. You correct the agent, it doesn't remember. Next session, same mistakes.

This MCP gives agents _just enough_ context so they match _how_ your team codes, know _why_, and _remember_ every correction.

Here's what codebase-context does:

**Finds the right context** - Search that doesn't just return code. Each result comes back with analyzed -and quantified- coding patterns and conventions, related team memories, file relationships, and quality indicators. The agent gets curated context, not raw hits.

**Knows your conventions** - Detected from your code, not only from rules you wrote. Seeks team consensus and direction by adoption percentages and trends (rising/declining), golden files. What patterns the team is moving toward and what's being left behind.

**Remembers across sessions** - Decisions, failures, things that _should_ work but didn't when you tried - recorded once, surfaced automatically. Conventional git commits (`refactor:`, `migrate:`, `fix:`) auto-extract into memory with zero effort. Stale memories decay and get flagged instead of blindly trusted.

**Checks before editing** - A preflight card with risk level, patterns to use and avoid, failure warnings, and a `readyToEdit` evidence check. If evidence is thin or contradictory, it says so.

One tool call returns all of it. Local-first - your code never leaves your machine.

<!-- TODO: Add demo GIF here showing search_codebase with preflight card output -->
<!-- ![Demo](./docs/assets/demo.gif) -->

## Quick Start

Add it to the configuration of your AI Agent of preference:

### Claude Code

```bash
claude mcp add codebase-context -- npx -y codebase-context /path/to/your/project
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codebase-context": {
      "command": "npx",
      "args": ["-y", "codebase-context", "/path/to/your/project"]
    }
  }
}
```

### VS Code (Copilot)

Add `.vscode/mcp.json` to your project root:

```json
{
  "servers": {
    "codebase-context": {
      "command": "npx",
      "args": ["-y", "codebase-context", "/path/to/your/project"] // Or "${workspaceFolder}"if your workspace is one project only
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "codebase-context": {
      "command": "npx",
      "args": ["-y", "codebase-context", "/path/to/your/project"]
    }
  }
}
```

### Windsurf

Open Settings > MCP and add:

```json
{
  "mcpServers": {
    "codebase-context": {
      "command": "npx",
      "args": ["-y", "codebase-context", "/path/to/your/project"]
    }
  }
}
```

## Codex

Run codex mcp add codebase-context npx -y codebase-context "/path/to/your/project"

## What It Actually Does

Other tools help AI find code. This one helps AI make the right decisions - by knowing what your team does, tracking where codebases are heading, and warning before mistakes happen.

### The Difference

| Without codebase-context                                | With codebase-context                               |
| ------------------------------------------------------- | --------------------------------------------------- |
| Generates code using whatever matches or "sounds" right | Generates code following your team conventions      |
| Copies any example that fits                            | Follows your best implementations (golden files)    |
| Repeats mistakes you already corrected                  | Surfaces failure memories right before trying again |
| You re-explain the same things every session            | Remembers conventions and decisions automatically   |
| Edits confidently even when context is weak             | Flags high-risk changes when evidence is thin       |
| Sees what the current code does and assumes             | Sees how your code has evolved and why              |

### The Search Tool (`search_codebase`)

This is where it all comes together. One call returns:

- **Code results** with `summary`, `snippet`, `filePath`, `score`, and `relevanceReason`
- **Pattern signals** per result: `trend` (Rising/Stable/Declining) and `patternWarning` when using legacy code
- **Relationships** per result: `importedBy`, `imports`, `testedIn`, `lastModified`
- **Related memories**: team decisions, gotchas, and failures matched to the query
- **Search quality**: `ok` or `low_confidence` with diagnostic signals and next steps

When the intent is `edit`, `refactor`, or `migrate`, the same call also returns a **preflight card**:

```json
{
  "preflight": {
    "intent": "refactor",
    "riskLevel": "medium",
    "confidence": "fresh",
    "evidenceLock": {
      "mode": "triangulated",
      "status": "pass",
      "readyToEdit": true,
      "score": 100,
      "sources": [
        { "source": "code", "strength": "strong", "count": 5 },
        { "source": "patterns", "strength": "strong", "count": 3 },
        { "source": "memories", "strength": "strong", "count": 2 }
      ]
    },
    "preferredPatterns": [...],
    "avoidPatterns": [...],
    "goldenFiles": [...],
    "failureWarnings": [...]
  },
  "results": [...]
}
```

Risk level, what to use, what to avoid, what broke last time, and whether the evidence is strong enough to proceed - all in one response.

### Patterns & Conventions (`get_team_patterns`)

Detects what your team actually does by analyzing the codebase:

- Adoption percentages for dependency injection, state management, testing, libraries
- Patterns/conventions trend direction (Rising / Stable / Declining) based on git recency
- Golden files - your best implementations ranked by modern pattern density
- Conflicts - when the team hasn't converged (both approaches above 20% adoption)

### Team Memory (`remember` + `get_memory`)

Record a decision once. It surfaces automatically in search results and preflight cards from then on. **Your git commits also become memories** - conventional commits like `refactor:`, `migrate:`, `fix:`, `revert:` from the last 90 days are auto-extracted during indexing.

- **Types**: conventions (style rules), decisions (architecture choices), gotchas (things that break), failures (we tried X, it broke because Y)
- **Confidence decay**: decisions age over 180 days, gotchas and failures over 90 days. Stale memories get flagged instead of blindly trusted.
- **Zero-config git extraction**: runs automatically during `refresh_index`. No setup, no manual work.

### All Tools

| Tool                           | What it does                                                        |
| ------------------------------ | ------------------------------------------------------------------- |
| `search_codebase`              | Hybrid search with enrichment. Pass `intent: "edit"` for preflight. |
| `get_team_patterns`            | Pattern frequencies, golden files, conflict detection               |
| `get_component_usage`          | "Find Usages" - where a library or component is imported            |
| `remember`                     | Record a convention, decision, gotcha, or failure                   |
| `get_memory`                   | Query team memory with confidence decay scoring                     |
| `get_codebase_metadata`        | Project structure, frameworks, dependencies                         |
| `get_style_guide`              | Style guide rules for the current project                           |
| `detect_circular_dependencies` | Import cycles between files                                         |
| `refresh_index`                | Re-index (full or incremental) + extract git memories               |
| `get_indexing_status`          | Progress and stats for the current index                            |

## How the Search Works

The retrieval pipeline is designed around one goal: give the agent the right context, not just any file that matches.

- **Intent classification** - knows whether "AuthService" is a name lookup or "how does auth work" is conceptual. Adjusts keyword/semantic weights accordingly.
- **Hybrid fusion (RRF)** - combines keyword and semantic search using Reciprocal Rank Fusion instead of brittle score averaging.
- **Query expansion** - conceptual queries automatically expand with domain-relevant terms (auth → login, token, session, guard).
- **Contamination control** - test files are filtered/demoted for non-test queries.
- **Import centrality** - files that are imported more often rank higher.
- **Cross-encoder reranking** - a stage-2 reranker triggers only when top scores are ambiguous. CPU-only, bounded to top-K.
- **Incremental Indexing** - Whenever a file is changed, it
- **Auto-heal** - if the index corrupts, search triggers a full re-index automatically.

## Language Support

Over **30+ languages** are supported: TypeScript, JavaScript, Python, Java, Kotlin, C/C++, C#, Go, Rust, PHP, Ruby, Swift, Scala, Shell, and common config/markup formats.
However right now only **Angular** has a specific analyzer for enriched context (signals, standalone components, control flow, DI patterns).
If you need enriched context from any language or framework, please file an issue - or even better, contribute with a new analyzer

Structured filters available: `framework`, `language`, `componentType`, `layer` (presentation, business, data, state, core, shared).

## Configuration

| Variable                 | Default        | Description                                               |
| ------------------------ | -------------- | --------------------------------------------------------- |
| `EMBEDDING_PROVIDER`     | `transformers` | `openai` (fast, cloud) or `transformers` (local, private) |
| `OPENAI_API_KEY`         | -              | Required only if using `openai` provider                  |
| `CODEBASE_ROOT`          | -              | Project root (CLI arg takes precedence)                   |
| `CODEBASE_CONTEXT_DEBUG` | -              | Set to `1` for verbose logging                            |

## Performance

- **First indexing**: 2-5 minutes for ~30k files (embedding computation).
- **Subsequent queries**: milliseconds from cache.
- **Incremental updates**: `refresh_index` with `incrementalOnly: true` processes only changed files (SHA-256 manifest diffing).

## File Structure

```
.codebase-context/
  memory.json         # Team knowledge (should be persisted in git)
  intelligence.json   # Pattern analysis (generated)
  index.json          # Keyword index (generated)
  index/              # Vector database (generated)
```

**Recommended `.gitignore`:**

```gitignore
# Codebase Context - ignore generated files, keep memory
.codebase-context/*
!.codebase-context/memory.json
```

## Tip: Ensuring your AI Agent recalls memory:

Add this to `.cursorrules`, `CLAUDE.md`, or `AGENTS.md`:

```
## Codebase Context

**At start of each task:** Call `get_memory` to load team conventions.

**When user says "remember this" or "record this":**
- Call `remember` tool IMMEDIATELY before doing anything else.
```

## Links

- [Motivation](./MOTIVATION.md) - Research and design rationale
- [Changelog](./CHANGELOG.md) - Version history
- [Contributing](./CONTRIBUTING.md) - How to add analyzers

## License

MIT
