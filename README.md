# codebase-context

## Local-first second brain for AI Agents working on your codebase

[![npm version](https://img.shields.io/npm/v/codebase-context)](https://www.npmjs.com/package/codebase-context) [![license](https://img.shields.io/npm/l/codebase-context)](./LICENSE) [![node](https://img.shields.io/node/v/codebase-context)](./package.json)

You're tired of AI agents writing code that 'just works' but fits like a square peg in a round hole - not your conventions, not your architecture, not your repo. Even with well-curated instructions. You correct the agent, it doesn't remember. Next session, same mistakes.

This MCP gives agents _just enough_ context so they match _how_ your team codes, know _why_, and _remember_ every correction.

Here's what codebase-context does:

**Finds the right context** - Search that doesn't just return code. Each result comes back with analyzed and quantified coding patterns and conventions, related team memories, file relationships, and quality indicators. It knows whether you're looking for a specific file, a concept, or how things wire together - and filters out the noise (test files, configs, old utilities) before the agent sees them. The agent gets curated context, not raw hits.

**Knows your conventions** - Detected from your code and git history, not only from rules you wrote. Seeks team consensus and direction by adoption percentages and trends (rising/declining), golden files. Tells the difference between code that's _common_ and code that's _current_ - what patterns the team is moving toward and what's being left behind.

**Remembers across sessions** - Decisions, failures, workarounds that look wrong but exist for a reason - the battle scars that aren't in the comments. Recorded once, surfaced automatically so the agent doesn't "clean up" something you spent a week getting right. Conventional git commits (`refactor:`, `migrate:`, `fix:`) auto-extract into memory with zero effort. Stale memories decay and get flagged instead of blindly trusted.

**Checks before editing** - A preflight card with risk level, patterns to use and avoid, failure warnings, and a `readyToEdit` evidence check. Catches the "confidently wrong" problem: when code, team memories, and patterns contradict each other, it tells the agent to ask instead of guess. If evidence is thin or contradictory, it says so.

One tool call returns all of it. Local-first - your code never leaves your machine.

<!-- TODO: Add demo GIF: search_codebase("How does this app attach the auth token to outgoing API calls?") → AuthInterceptor top result + preflight + agent proceeds or asks -->
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

- **Code results** with `file` (path + line range), `summary`, `score`
- **Type** per result: compact `componentType:layer` (e.g., `service:data`) — helps agents orient
- **Pattern signals** per result: `trend` (Rising/Declining — Stable is omitted) and `patternWarning` when using legacy code
- **Relationships** per result: `importedByCount` and `hasTests` (condensed) + **hints** (capped ranked callers, consumers, tests)
- **Related memories**: up to 3 team decisions, gotchas, and failures matched to the query
- **Search quality**: `ok` or `low_confidence` with confidence score and `hint` when low
- **Preflight**: `ready` (boolean) with decision card when `intent="edit"|"refactor"|"migrate"`. Shows `nextAction` (if not ready), `warnings`, `patterns` (do/avoid), `bestExample`, `impact` (caller coverage), and `whatWouldHelp` (next steps). If search quality is low, `ready` is always `false`.

Snippets are opt-in (`includeSnippets: true`). Default output is lean — if the agent wants code, it calls `read_file`.

```json
{
  "searchQuality": { "status": "ok", "confidence": 0.72 },
  "preflight": {
    "ready": false,
    "nextAction": "2 of 5 callers aren't in results — search for src/app.module.ts",
    "patterns": {
      "do": ["HttpInterceptorFn — 97%", "standalone components — 84%"],
      "avoid": ["constructor injection — 3% (declining)"]
    },
    "bestExample": "src/auth/auth.interceptor.ts",
    "impact": {
      "coverage": "3/5 callers in results",
      "files": ["src/app.module.ts", "src/boot.ts"]
    },
    "whatWouldHelp": [
      "Search for src/app.module.ts to cover the main caller",
      "Call get_team_patterns for auth/ injection patterns"
    ]
  },
  "results": [
    {
      "file": "src/auth/auth.interceptor.ts:1-20",
      "summary": "HTTP interceptor that attaches auth token to outgoing requests",
      "score": 0.72,
      "type": "service:core",
      "trend": "Rising",
      "relationships": { "importedByCount": 4, "hasTests": true },
      "hints": {
        "callers": ["src/app.module.ts", "src/boot.ts"],
        "tests": ["src/auth/auth.interceptor.spec.ts"]
      }
    }
  ],
  "relatedMemories": ["Always use HttpInterceptorFn (0.97)"]
}
```

Lean enough to fit on one screen. If search quality is low, preflight blocks edits instead of faking confidence.

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

| Tool                           | What it does                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `search_codebase`              | Hybrid search + decision card. Pass `intent="edit"` to get `ready`, `nextAction`, patterns, caller coverage, and `whatWouldHelp`. |
| `get_team_patterns`            | Pattern frequencies, golden files, conflict detection                                      |
| `get_symbol_references`        | Find concrete references to a symbol (usageCount + top snippets + confidence + completeness) |
| `remember`                     | Record a convention, decision, gotcha, or failure                                          |
| `get_memory`                   | Query team memory with confidence decay scoring                                            |
| `get_codebase_metadata`        | Project structure, frameworks, dependencies                                                |
| `get_style_guide`              | Style guide rules for the current project                                                  |
| `detect_circular_dependencies` | Import cycles between files                                                                |
| `refresh_index`                | Re-index (full or incremental) + extract git memories                                      |
| `get_indexing_status`          | Progress and stats for the current index                                                   |

## Evaluation Harness (`npm run eval`)

Reproducible evaluation with frozen fixtures so ranking/chunking changes are measured honestly and regressions get caught.

- Two codebases: `npm run eval -- <codebaseA> <codebaseB>`
- Defaults: fixture A = `tests/fixtures/eval-angular-spotify.json`, fixture B = `tests/fixtures/eval-controlled.json`
- Offline smoke (no network):

```bash
npm run eval -- tests/fixtures/codebases/eval-controlled tests/fixtures/codebases/eval-controlled \
  --fixture-a=tests/fixtures/eval-controlled.json \
  --fixture-b=tests/fixtures/eval-controlled.json \
  --skip-reindex --no-rerank
```

- Flags: `--help`, `--fixture-a`, `--fixture-b`, `--skip-reindex`, `--no-rerank`, `--no-redact`

## How the Search Works

The retrieval pipeline is designed around one goal: give the agent the right context, not just any file that matches.

- **Intent classification** - knows whether "AuthService" is a name lookup or "how does auth work" is conceptual. Adjusts keyword/semantic weights accordingly.
- **Hybrid fusion (RRF)** - combines keyword and semantic search using Reciprocal Rank Fusion instead of brittle score averaging.
- **Query expansion** - conceptual queries automatically expand with domain-relevant terms (auth → login, token, session, guard).
- **Contamination control** - test files are filtered/demoted for non-test queries.
- **Import centrality** - files that are imported more often rank higher.
- **Cross-encoder reranking** - a stage-2 reranker triggers only when top scores are ambiguous. CPU-only, bounded to top-K.
- **Incremental indexing** - only re-indexes files that changed since last run (SHA-256 manifest diffing).
- **Version gating** - index artifacts are versioned; mismatches trigger automatic rebuild so mixed-version data is never served.
- **Auto-heal** - if the index corrupts, search triggers a full re-index automatically.

## Language Support

Over **30+ languages** are supported for indexing + retrieval: TypeScript/JavaScript, Python (incl `.pyi`), PHP, Ruby, Java, Kotlin (`.kt`/`.kts`), Go, Rust, C/C++ (incl `.cc`/`.cxx`), C#, Swift, Scala, Shell, plus common config/markup formats (JSON/YAML/TOML/XML, etc.).

Enrichment is framework-specific: right now only **Angular** has a dedicated analyzer for rich conventions/context (signals, standalone components, control flow, DI patterns).

For non-Angular projects, the **Generic** analyzer still provides broad coverage, and will use Tree-sitter symbol extraction when a grammar is available (otherwise it falls back to safe parsing).

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
  index-meta.json     # Index metadata and version (generated)
  intelligence.json   # Pattern analysis (generated)
  relationships.json  # File/symbol relationships (generated)
  index.json          # Keyword index (generated)
  index/              # Vector database (generated)
```

**Recommended `.gitignore`:**

```gitignore
# Codebase Context - ignore generated files, keep memory
.codebase-context/*
!.codebase-context/memory.json
```

## CLI Access (Vendor-Neutral)

You can manage team memory directly from the terminal without any AI agent:

```bash
# List all memories
npx codebase-context memory list

# Filter by category or type
npx codebase-context memory list --category conventions --type convention

# Search memories
npx codebase-context memory list --query "auth"

# Add a memory
npx codebase-context memory add --type convention --category tooling --memory "Use pnpm, not npm" --reason "Workspace support and speed"

# Remove a memory
npx codebase-context memory remove <id>

# JSON output for scripting
npx codebase-context memory list --json
```

Set `CODEBASE_ROOT` to point to your project, or run from the project directory.

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
