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

## What You Get

- **Internal library discovery** → `@mycompany/ui-toolkit`: 847 uses vs `primeng`: 3 uses
- **Pattern frequencies** → `inject()`: 97%, `constructor()`: 3%
- **Pattern momentum** → `Signals`: Rising (last used 2 days ago) vs `RxJS`: Declining (180+ days)
- **Golden file examples** → Real implementations showing all patterns together
- **Testing conventions** → `Jest`: 74%, `Playwright`: 6%
- **Framework patterns** → Angular signals, standalone components, etc.

## How It Works

When generating code, the agent checks your patterns first:

| Without MCP | With MCP |
|-------------|----------|
| Uses `constructor(private svc: Service)` | Uses `inject()` (97% team adoption) |
| Suggests `primeng/button` directly | Uses `@codeblue/prime` wrapper |
| Generic Jest setup | Your team's actual test utilities |

### Tip: Auto-invoke in your rules

Add this to your `.cursorrules`, `CLAUDE.md`, or `AGENTS.md`:

```
When generating or reviewing code, use codebase-context tools to check team patterns first.
```

Now the agent checks patterns automatically instead of waiting for you to ask.

## Tools

| Tool | Purpose |
|------|---------|
| `search_codebase` | Semantic + keyword hybrid search |
| `get_component_usage` | Find where a library/component is used |
| `get_team_patterns` | Pattern frequencies + canonical examples |
| `get_codebase_metadata` | Project structure overview |
| `get_style_guide` | Query style guide rules |
| `refresh_index` | Re-index the codebase |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_PROVIDER` | `transformers` | `openai` (fast, cloud) or `transformers` (local, private) |
| `OPENAI_API_KEY` | - | Required if provider is `openai` |

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
