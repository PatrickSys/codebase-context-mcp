# codebase-context

**AI coding agents don't know your codebase. This MCP fixes that.**

Your team has internal libraries, naming conventions, and patterns that external AI models have never seen. This MCP server gives AI assistants real-time visibility into your codebase: which libraries your team actually uses, how often, and where to find canonical examples.

## Quick Start

Add this to your MCP client config (Claude Desktop, VS Code, Cursor, etc.).

```json
"mcpServers": {
  "codebase-context": {
    "command": "npx",
    "args": ["codebase-context", "/path/to/your/project"]
  }
}
```

If your environment prompts on first run, use `npx --yes ...` (or `npx -y ...`) to auto-confirm.

## What You Get

- **Internal library discovery** → `@mycompany/ui-toolkit`: 847 uses vs `primeng`: 3 uses
- **Pattern frequencies** → `inject()`: 97%, `constructor()`: 3%
- **Pattern momentum** → `Signals`: Rising (last used 2 days ago) vs `RxJS`: Declining (180+ days)
- **Golden file examples** → Real implementations showing all patterns together
- **Testing conventions** → `Jest`: 74%, `Playwright`: 6%
- **Framework patterns** → Angular signals, standalone components, etc.
- **Circular dependency detection** → Find toxic import cycles between files
- **Memory system** → Record "why" behind choices so AI doesn't repeat mistakes

## How It Works

When generating code, the agent checks your patterns first:

| Without MCP                              | With MCP                             |
| ---------------------------------------- | ------------------------------------ |
| Uses `constructor(private svc: Service)` | Uses `inject()` (97% team adoption)  |
| Suggests `primeng/button` directly       | Uses `@mycompany/ui-toolkit` wrapper |
| Generic Jest setup                       | Your team's actual test utilities    |

### Tip: Auto-invoke in your rules

Add this to your `.cursorrules`, `CLAUDE.md`, or `AGENTS.md`:

```
## Codebase Context

**At start of each task:** Call `get_memory` to load team conventions.

**CRITICAL:** When user says "remember this" or "record this":
- STOP immediately and call `remember` tool FIRST
- DO NOT proceed with other actions until memory is recorded
- This is a blocking requirement, not optional
```

Now the agent checks patterns automatically instead of waiting for you to ask.

## Tools

| Tool                           | Purpose                                       |
| ------------------------------ | --------------------------------------------- |
| `search_codebase`              | Semantic + keyword hybrid search              |
| `get_component_usage`          | Find where a library/component is used        |
| `get_team_patterns`            | Pattern frequencies + canonical examples      |
| `get_codebase_metadata`        | Project structure overview                    |
| `get_indexing_status`          | Indexing progress + last stats                |
| `get_style_guide`              | Query style guide rules                       |
| `detect_circular_dependencies` | Find import cycles between files              |
| `remember`                     | Record memory (conventions/decisions/gotchas) |
| `get_memory`                   | Query recorded memory by category/keyword     |
| `refresh_index`                | Re-index the codebase                         |

## File Structure

The MCP creates the following structure in your project:

```
.codebase-context/
  ├── memory.json         # Team knowledge (commit this)
  ├── intelligence.json   # Pattern analysis (generated)
  ├── index.json          # Keyword index (generated)
  └── index/              # Vector database (generated)
```

**Recommended `.gitignore`:** The vector database and generated files can be large. Add this to your `.gitignore` to keep them local while sharing team memory:

```gitignore
# Codebase Context MCP - ignore generated files, keep memory
.codebase-context/*
!.codebase-context/memory.json
```

### Memory System

Patterns tell you _what_ the team does ("97% use inject"), but not _why_ ("standalone compatibility"). Use `remember` to capture rationale that prevents repeated mistakes:

```typescript
// AI won't change this again after recording the decision
remember({
  type: 'decision',
  category: 'dependencies',
  memory: 'Use node-linker: hoisted, not isolated',
  reason:
    "Some packages don't declare transitive deps. Isolated forces manual package.json additions."
});
```

Memories surface automatically in `search_codebase` results and `get_team_patterns` responses.

**Early baseline — known quirks:**

- Agents may bundle multiple things into one entry
- Duplicates can happen if you record the same thing twice
- Edit `.codebase-context/memory.json` directly to clean up
- Be explicit: "Remember this: use X not Y"

## Configuration

| Variable                 | Default        | Description                                                                    |
| ------------------------ | -------------- | ------------------------------------------------------------------------------ |
| `EMBEDDING_PROVIDER`     | `transformers` | `openai` (fast, cloud) or `transformers` (local, private)                      |
| `OPENAI_API_KEY`         | -              | Required if provider is `openai`                                               |
| `CODEBASE_ROOT`          | -              | Project root to index (CLI arg takes precedence)                               |
| `CODEBASE_CONTEXT_DEBUG` | -              | Set to `1` to enable verbose logging (startup messages, analyzer registration) |

## Performance Note

This tool runs **locally** on your machine using your hardware.

- **Initial Indexing**: The first run works hard. It may take several minutes (e.g., ~2-5 mins for 30k files) to compute embeddings for your entire codebase.
- **Caching**: Subsequent queries are instant (milliseconds).
- **Updates**: Currently, `refresh_index` re-scans the codebase. True incremental indexing (processing only changed files) is on the roadmap.

## Links

- 📄 [Motivation](./MOTIVATION.md) — Why this exists, research, learnings
- 📋 [Changelog](./CHANGELOG.md) — Version history
- 🤝 [Contributing](./CONTRIBUTING.md) — How to add analyzers

## License

MIT

