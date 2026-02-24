# codebase-context

## Local-first second brain for AI agents — patterns, memory, and evidence scoring for any codebase

[![npm version](https://img.shields.io/npm/v/codebase-context)](https://www.npmjs.com/package/codebase-context) [![license](https://img.shields.io/npm/l/codebase-context)](./LICENSE) [![node](https://img.shields.io/node/v/codebase-context)](./package.json)

You're tired of AI agents writing code that 'just works' but fits like a square peg in a round hole - not your conventions, not your architecture, not your repo. Even with well-curated instructions. You correct the agent, it doesn't remember. Next session, same mistakes.

This MCP gives agents _just enough_ context so they match _how_ your team codes, know _why_, and _remember_ every correction.

Here's what it gives the agent on every search:

**Finds the right context** - Search that doesn't just return code. Each result comes back with analyzed and quantified coding patterns and conventions, related team memories, file relationships, and quality indicators. Filters noise (test files, configs, old utilities) before the agent sees it. Parses code structure with Tree-sitter where available — results include symbol scope and caller relationships, not just file matches.

**Knows your conventions** - Detected from your code and git history, not only from rules you wrote. Seeks team consensus and direction by adoption percentages and trends (rising/declining), golden files. Tells the difference between code that's _common_ and code that's _current_ - what patterns the team is moving toward and what's being left behind. (Golden files are your best implementations, auto-selected by pattern recency and consistency — not by you.)

**Remembers across sessions** - Decisions, failures, workarounds that look wrong but exist for a reason - the battle scars that aren't in the comments. Recorded once, surfaced automatically so the agent doesn't "clean up" something you spent a week getting right. Conventional git commits (`refactor:`, `migrate:`, `fix:`) auto-extract into memory with zero effort. Stale memories decay and get flagged instead of blindly trusted.

**Checks before editing** - Before editing something, you get a decision card showing whether there's enough evidence to proceed. If a symbol has four callers and only two appear in your search results, the card shows that coverage gap. If coverage is low, `whatWouldHelp` lists the specific searches to run before you touch anything. When code, team memories, and patterns contradict each other, it tells you to look deeper instead of guessing.

<!-- Uncomment when docs/assets/preflight-example.png exists:
![Preflight example](./docs/assets/preflight-example.png)
_Decision card showing caller coverage, patterns to follow, and what to search next before editing._
-->

All local. Your code never leaves your machine.

<!-- Add docs/assets/demo.gif for hero visual (see docs/assets/README.md). Caption: One search returns code, patterns, and preflight. Recorded against angular-spotify. -->
<!-- ![Demo](./docs/assets/demo.gif) -->

_One call: ranked results + conventions + edit-readiness. (Recorded against angular-spotify.)_

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

### Codex

```bash
codex mcp add codebase-context npx -y codebase-context "/path/to/your/project"
```

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
- **Relationships** per result: `importedByCount` and `hasTests` (condensed) + **hints** (capped ranked callers, consumers, tests) — so you see suggested next reads and know what you haven't looked at yet
- **Related memories**: up to 3 team decisions, gotchas, and failures matched to the query
- **Search quality**: `ok` or `low_confidence` with confidence score and `hint` when low
- **Preflight**: `ready` (boolean) with decision card when `intent="edit"|"refactor"|"migrate"`. Shows `nextAction` (if not ready), `warnings`, `patterns` (do/avoid), `bestExample`, `impact` (caller coverage), and `whatWouldHelp` (next steps). If search quality is low, `ready` is always `false`.

Snippets are optional (`includeSnippets: true`). When enabled, snippets that have symbol metadata (e.g. from the Generic analyzer's AST chunking or Angular component chunks) start with a scope header so you know where the code lives (e.g. `// AuthService.getToken()` or `// SpotifyApiService`). Example:

```ts
// AuthService.getToken()
getToken(): string {
  return this.token;
}
```

Default output is lean — if the agent wants code, it calls `read_file`.

### What changes for the agent

Without codebase-context: the agent searches, gets matching files, picks an example, and copies whatever pattern it finds — including the old ones.

With codebase-context: the same search returns which patterns are current vs declining in your codebase, which files import the thing being edited, whether there's enough evidence to proceed, and what the team decided last time someone touched this area. The agent can make a different kind of decision.

The pattern data isn't rules you wrote — it's adoption percentages derived from your actual code. If 89% of your codebase uses one approach and 11% uses a legacy approach, the agent sees that signal before writing anything.

<details>
<summary>Example response shape (one search call)</summary>

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
    "impact": { "coverage": "3/5 callers in results" },
    "whatWouldHelp": ["Search for src/app.module.ts to cover the main caller"]
  },
  "results": [
    {
      "file": "src/auth/auth.interceptor.ts:1-20",
      "summary": "HTTP interceptor that attaches auth token to outgoing requests",
      "score": 0.72,
      "type": "service:core",
      "trend": "Rising",
      "hints": { "callers": ["src/app.module.ts", "src/boot.ts"] }
    }
  ],
  "relatedMemories": ["Always use HttpInterceptorFn (0.97)"]
}
```

</details>

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

| Tool                           | What it does                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_codebase`              | Hybrid search + decision card. Pass `intent="edit"` to get `ready`, `nextAction`, patterns, caller coverage, and `whatWouldHelp`.                       |
| `get_team_patterns`            | Pattern frequencies, golden files, conflict detection                                                                                                   |
| `get_symbol_references`        | Find concrete references to a symbol (usageCount + top snippets). `confidence: "syntactic"` = static/source-based only; no runtime or dynamic dispatch. |
| `remember`                     | Record a convention, decision, gotcha, or failure                                                                                                       |
| `get_memory`                   | Query team memory with confidence decay scoring                                                                                                         |
| `get_codebase_metadata`        | Project structure, frameworks, dependencies                                                                                                             |
| `get_style_guide`              | Style guide rules for the current project                                                                                                               |
| `detect_circular_dependencies` | Import cycles between files                                                                                                                             |
| `refresh_index`                | Re-index (full or incremental) + extract git memories                                                                                                   |
| `get_indexing_status`          | Progress and stats for the current index                                                                                                                |

## Evaluation Harness (`npm run eval`)

Reproducible evaluation against frozen fixtures. Run it yourself to measure retrieval quality on real code, not on our claims.

Offline smoke test (no network required):

```bash
npm run eval -- tests/fixtures/codebases/eval-controlled tests/fixtures/codebases/eval-controlled \
  --fixture-a=tests/fixtures/eval-controlled.json \
  --fixture-b=tests/fixtures/eval-controlled.json \
  --skip-reindex --no-rerank
```

Reported metrics: Top-1 accuracy, Top-3 recall, spec contamination rate. The angular-spotify fixture is a real public TypeScript codebase — run it to verify search quality on idiomatic code, not just our internal benchmarks.

## How the Search Works

The retrieval pipeline is designed around one goal: give the agent the right context, not just any file that matches.
**Semantic, not just keyword.** Query "skip to next song" finds the player API that implements next-track logic even when the word "skip" never appears in the file. Grep would return nothing; codebase-context uses hybrid (keyword + semantic) search so natural-language questions map to the right code. See [eval fixture design](tests/fixtures/README.md#semantic-queries-not-keyword-matching) for how we test this.

- **Definition-first ranking** - for exact-name lookups (e.g. a symbol name), the file that _defines_ the symbol ranks above files that only use it.
- **Intent classification** - knows whether "AuthService" is a name lookup or "how does auth work" is conceptual. Adjusts keyword/semantic weights accordingly.
- **Hybrid fusion (RRF)** - combines keyword and semantic search using Reciprocal Rank Fusion instead of brittle score averaging.
- **Query expansion** - conceptual queries automatically expand with domain-relevant terms (auth → login, token, session, guard).
- **Contamination control** - test files are filtered/demoted for non-test queries.
- **Import centrality** - files that are imported more often rank higher.
- **Cross-encoder reranking** - a stage-2 reranker triggers only when top scores are ambiguous. CPU-only, bounded to top-K.
- **Incremental indexing** - only re-indexes files that changed since last run (SHA-256 manifest diffing).
- **Version gating** - index artifacts are versioned; mismatches trigger automatic rebuild so mixed-version data is never served.
- **Auto-heal** - if the index corrupts, search triggers a full re-index automatically.

**Index reliability:** Rebuilds write to a staging directory and swap atomically only on success, so a failed rebuild never corrupts the active index. Version mismatches or corruption trigger an automatic full re-index (no user action required).

## Language Support

**10 languages** have full symbol extraction (Tree-sitter): TypeScript, JavaScript, Python, Java, Kotlin, C, C++, C#, Go, Rust. **30+ languages** have indexing and retrieval coverage (keyword + semantic), including PHP, Ruby, Swift, Scala, Shell, and config/markup (JSON/YAML/TOML/XML, etc.).

Enrichment is framework-specific: right now only **Angular** has a dedicated analyzer for rich conventions/context (signals, standalone components, control flow, DI patterns).

For non-Angular projects, the **Generic** analyzer uses **AST-aligned chunking** when a Tree-sitter grammar is available: symbol-bounded chunks with **scope-aware prefixes** (e.g. `// ClassName.methodName`) so snippets show where code lives. Without a grammar it falls back to safe line-based chunking.

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
- **Search latency**:
  - **MCP server (Cursor, Claude, etc.)**: First query in a session pays a one-time cost to load the embedding model and optional reranker (~1–2 s). Subsequent queries are **sub-second** (tens to low hundreds of ms) because the process stays alive and models stay in memory.
  - **CLI one-shot** (`npx codebase-context search --query "..."`): Each invocation starts a new NodeJS process and loads models from scratch, so **every** query takes ~2 s. Use the CLI for scripting; for interactive use, the MCP server is fast after the first call.
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

## CLI Reference

All MCP tools are available as CLI commands — no AI agent required. Useful for scripting, debugging, and CI workflows.

Set `CODEBASE_ROOT` to your project root, or run from the project directory.

`patterns`, `search`, and `refs` render structured ASCII art by default. Pass `--json` for raw JSON.

```
$ npx codebase-context patterns 2>/dev/null

┌─ Team Patterns ────────────────────────────────────────────┐
│                                                            │
│ DEPENDENCY INJECTION                                       │
│   Constructor injection         84%      declining         │
│   inject() function             16%      rising            │
│                                                            │
│ COMPONENT STYLE                                            │
│   Standalone component          100%                       │
│                                                            │
│ GOLDEN FILES                                               │
│   src/lib/card.component.ts     4 patterns                 │
│   src/lib/playlist.component.ts 3 patterns                 │
│                                                            │
│ CONFLICTS                                                  │
│   dependencyInjection: Constructor (84%) vs inject() (16%) │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

```
$ npx codebase-context search --query "how does auth work" --intent edit 2>/dev/null

┌─ Search: "how does auth work" ─── intent: edit ────────────┐
│ Quality: ok (0.85)                                         │
│ Ready to edit: YES                                         │
│                                                            │
│ Patterns:                                                  │
│   ✓ HttpInterceptorFn — 97%                                │
│   ✓ Standalone component — 84%                             │
│   ✗ Constructor injection — 3% (declining)                 │
│                                                            │
│ Best example: src/auth/auth.interceptor.ts                 │
│ Callers: 3/5 callers in results                            │
└────────────────────────────────────────────────────────────┘

1.  src/auth/auth.interceptor.ts:1-42
    score: 1.41 | interceptor (core) | rising
    Angular HTTP interceptor 'AuthInterceptor'
    callers: src/app.config.ts, src/boot.ts
```

```
$ npx codebase-context refs --symbol "AuthStore" 2>/dev/null

┌─ AuthStore ─── 10 references ─── syntactic ────────────────┐
│                                                            │
│ AuthStore                                                  │
│ │                                                          │
│ ├─ src/auth/auth.interceptor.ts:15                        │
│ │  import { AuthStore } from '../store/auth.store'        │
│ │                                                          │
│ ├─ src/auth/auth.guard.ts:8                               │
│ │  constructor(private auth: AuthStore)                   │
│ │                                                          │
│ └─ src/profile/profile.component.ts:31                    │
│    this.authStore.getProfile()                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

```bash
# Search the indexed codebase
npx codebase-context search --query "authentication middleware"
npx codebase-context search --query "auth" --intent edit --limit 5

# Project structure, frameworks, and dependencies
npx codebase-context metadata

# Index state and progress
npx codebase-context status

# Re-index the codebase
npx codebase-context reindex
npx codebase-context reindex --incremental --reason "added new service"

# Style guide rules
npx codebase-context style-guide
npx codebase-context style-guide --query "naming" --category patterns

# Team patterns (DI, state, testing, etc.)
npx codebase-context patterns
npx codebase-context patterns --category testing

# Symbol references
npx codebase-context refs --symbol "UserService"
npx codebase-context refs --symbol "handleLogin" --limit 20

# Circular dependency detection
npx codebase-context cycles
npx codebase-context cycles --scope src/features

# Memory management
npx codebase-context memory list
npx codebase-context memory list --category conventions --type convention
npx codebase-context memory list --query "auth" --json
npx codebase-context memory add --type convention --category tooling --memory "Use pnpm, not npm" --reason "Workspace support and speed"
npx codebase-context memory remove <id>
```

All commands accept `--json` for raw JSON output suitable for piping and scripting.

## Tip: Ensuring your AI Agent recalls memory:

Add this to `.cursorrules`, `CLAUDE.md`, or `AGENTS.md`:

```
## Codebase Context

**At start of each task:** Call `get_memory` to load team conventions.

**When user says "remember this" or "record this":**
- Call `remember` tool IMMEDIATELY before doing anything else.
```

## Links

- [Capabilities](./docs/capabilities.md) - Technical reference
- [Motivation](./MOTIVATION.md) - Research and design rationale
- [Changelog](./CHANGELOG.md) - Version history
- [Contributing](./CONTRIBUTING.md) - How to add analyzers

## License

MIT
