# codebase-context-mcp

**The "missing cortex" for AI coding agents.** Internal library discovery, wrapper detection, and evidence-backed patterns—the context that `AGENTS.md` can't provide.

---

## The Problem

AI coding assistants (Copilot, Cursor, Claude) can generate instruction files (`AGENTS.md`, `.cursorrules`). They analyze your code and extract conventions. Impressive.

**But they can't tell the AI about your internal libraries.**

Your team wraps PrimeNG with `@mycompany/ui-toolkit`. You have utilities at `@mycompany/utils`. The AI has no way to know these exist—they're not in any Angular doc or Stack Overflow answer. So it suggests `primeng/button` when it should suggest `@mycompany/ui-toolkit/button`.

That's the gap we fill.

---

## What We Provide

### 1. Internal Library Discovery

Other tools find where things are **defined**. We find where things are **used**.

```bash
get_component_usage("@mycompany/ui-toolkit")
# → "usageCount": 847, "usedIn": [...]
```

The AI now knows: this library exists and is heavily used. Combined with tsconfig paths (which we also expose), the AI can infer it's internal.

### 2. Wrapper Detection (AI-Inferred)

We expose raw usage data that lets the AI infer wrapper relationships:

```json
{
  "topUsed": [
    { "source": "@mycompany/ui-toolkit", "count": 847 },
    { "source": "primeng", "count": 3 }
  ],
  "tsconfigPaths": {
    "@mycompany/*": ["libs/*"]
  }
}
```

The AI sees: `@mycompany/ui-toolkit` is used 847x vs `primeng` at 3x, and `@mycompany/*` maps to local code. It infers `@mycompany/ui-toolkit` is the preferred wrapper.

### 3. Golden Files (Context Window Efficiency)

Instead of the AI doing multiple searches—"find inject usage... find signals... find standalone..."—we provide ONE file that demonstrates all patterns together.

```json
{
  "file": "settings.component.ts",
  "score": 5,
  "patterns": { "inject": true, "signals": true, "effect": true, "standalone": true }
}
```

One file. All patterns. Minimal tokens. No Frankenstein code.

### 4. Testing Framework Detection

We detect your actual testing stack from code patterns, not just `package.json`:

```json
{
  "testingFramework": { "primary": "Jest", "frequency": "100%" },
  "testMocking": { "primary": "Jest mocks", "frequency": "87%" }
}
```

No more Jasmine syntax in a Jest project.

---

## Relationship with AGENTS.md

| | AGENTS.md | codebase-context-mcp |
|---|---|---|
| **Provides** | What team *wants* (guidance) | What team *does* (evidence) |
| **Internal libraries** | ❌ Can't discover | ✅ Tracks usage counts |
| **Canonical examples** | ❌ Describes rules | ✅ Finds real implementations |
| **Format** | Prose | Structured JSON |

**They're complementary. Use both.**

AGENTS.md tells the AI what you *want*. We show what you *actually do*—and surface the internal libraries and examples that no doc can provide.

---

## Tools

| Tool | What It Does |
|------|--------------|
| **`get_component_usage`** | Find WHERE a library/component is used ("Find Usages") |
| **`get_team_patterns`** | Pattern frequencies + canonical examples + golden files |
| `search_codebase` | Semantic + keyword hybrid search |
| `get_codebase_metadata` | Project structure + patterns summary |
| `get_style_guide` | Style guide content lookup |
| `get_indexing_status` | Index state + file watcher status + pending changes |
| `refresh_index` | Re-index (supports `incrementalOnly: true` for faster updates) |



---

## Architecture

```
┌───────────────────────────────────────────────────────┐
│            codebase-context-mcp (Core)                │
│  • Hybrid search (semantic + keyword)                 │
│  • Import graph (who uses what)                       │
│  • tsconfig paths extraction                          │
│  • Golden file discovery                              │
└──────────────────────────┬────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
 Angular Analyzer    [Future: React]    Generic Analyzer
 (DI patterns,        (hooks, state,   (TS/JS fallback)
  Signals, etc.)       components)
```

**Framework-agnostic core** with specialized analyzers:

- **Generic Analyzer**: Works on ANY project (JS, TS, Python, Java, Go, Rust, etc.)
- **Angular Analyzer**: Specialized patterns (inject, signals, standalone, etc.)
- **Future**: React, Vue analyzers planned

File watcher auto-enabled by default. Disable with `WATCH_FILES=false`.

---

## Setup

### Install from npm

```bash
npm install -g codebase-context-mcp
```

Or use with npx (no install needed):

```bash
npx codebase-context-mcp /path/to/your/project
```

### Configure in your MCP client (e.g., Claude Desktop)

```json
{
  "codebase-context-mcp": {
    "command": "npx",
    "args": ["codebase-context-mcp", "/path/to/your/project"]
  }
}
```

Or if installed globally:

```json
{
  "codebase-context-mcp": {
    "command": "codebase-context",
    "args": ["/path/to/your/project"]
  }
}
```

---

## What We Don't Do

We stay focused. Here's what we deliberately exclude:

| Feature | Why Not | Who Does It |
|---------|---------|-------------|
| Infer "preferred" vs "legacy" | Requires team input | Your AGENTS.md |
| Cross-repo context | Scope creep | Sequa |
| Code violation detection | Different niche | ESLint, CodeScene |
| External library docs | Different problem | Context7 |

---

## Known Limitations

| Limitation | Status | Mitigation |
|------------|--------|------------|
| **Specialized patterns are Angular-only** | MVP | Generic analyzer works on any JS/TS, React/Vue specialists planned. |
| **Single repo** | MVP | Multi-repo (Nx workspaces) planned for Phase 2. |
| **Pattern frequency ≠ correctness** | By design | Shows team consensus, not "right" patterns. Combine with AGENTS.md. |


---

## Why This Exists

📄 **[Why This Exists: Evidence](./EVIDENCE.md)** — The research and pain points that led to this  
📄 **[Research Notes](./research/06-arxiv-research.md)** — What I learned from the papers  
📄 **[Competitive Analysis](./research/02-competitive-validation.md)** — How we compare to alternatives

---

## License

MIT
