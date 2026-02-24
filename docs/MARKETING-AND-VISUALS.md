# Launch Plan: Post Drafts, Distribution & Blocker Checklist

Last updated: 2026-02-22. Post drafts are ready to copy-paste once blockers are cleared.

---

## Pre-Launch Blockers (fix before posting ANYWHERE)

- [ ] **BROKEN IMAGE**: `docs/assets/preflight-example.png` referenced in README — doesn't exist. Broken icon on GitHub/npm.
- [ ] **BROKEN LINK**: `docs/comparison-grep.md` linked from README Links section — file doesn't exist. 404.
- [ ] **CHANGELOG mess**: v1.7.0 has auto-generated commit messages ("02-03:", "04-01:") AND a separate `[Unreleased]` section duplicating the same features in readable form. Pick one. Merge [Unreleased] into v1.7.0, rewrite in human voice.
- [ ] **JSON example removed**: README now has prose about "what changes for the agent" but no concrete output. Add a `<details>` collapsed block with the JSON example below the prose.

## Pre-Launch Polish (nice-to-have, not blocking)

- [ ] Take Screenshot A: `npx codebase-context patterns` output on any TypeScript project
- [ ] Take Screenshot B: `npx codebase-context search --query "auth" --intent edit` output
- [ ] Enable GitHub Discussions (Settings > Features > Discussions)
- [ ] Set social preview image (Settings > Social Preview, 1280x640)
- [ ] Verify README renders correctly on GitHub and npmjs.com after all fixes
- [ ] Submit to registries (see table below)

---

## Reddit Post 1: r/ClaudeAI (PRIMARY — post Thursday evening 6-9pm ET)

**Title options (pick one):**

> A) My AI writes correct code. Just not *our* code. So I built something that shows it what "correct" actually means in my codebase.

> B) Claude follows my CLAUDE.md rules fine. The problem is rules can't capture what my team *actually* codes like right now.

> C) I got tired of correcting the AI on patterns we already moved past. So I showed it the codebase directly.

*(A is most human and punchy, recommend A)*

**Body:**

```
Every AI-assisted PR I review has the same problem: the code works, it compiles, it passes CI.
But it uses the pattern we migrated away from six months ago. Or it reaches for a library when we
have an internal wrapper that 90% of the codebase uses. Or it introduces a service pattern that
nobody's written in a year because we found a better way.

The AI isn't being dumb. It's being generic. It doesn't know what YOUR team does, what you've
moved away from, or what the current consensus is. CLAUDE.md helps. But you can't write rules for
everything — especially for things that are still in flux, or that you don't even realize need a rule
until the AI gets it wrong.

So I built codebase-context. It indexes your codebase and surfaces what's actually happening in your
code right now: which patterns are in wide use (with exact adoption %), which ones are declining, which
files are the canonical examples worth following. And it wires all of this into every search the agent
does — without you having to specify it.

[Screenshot A: pattern adoption output — X% rising, Y% declining, actual numbers from your code]

It also records team decisions (or extracts them from conventional commits automatically), and checks
before any edit whether the agent actually has enough evidence to proceed — not just whether it's
"confident."

[Screenshot B: decision card showing ready: false, caller coverage, what to search next]

One line to set it up with Claude Code:

    claude mcp add codebase-context -- npx -y codebase-context /path/to/project

Works with Claude Desktop, Cursor, VS Code Copilot, Windsurf, Codex too. 30+ languages, all local,
code never leaves your machine.

GitHub: https://github.com/PatrickSys/codebase-context
```

---

## Reddit Post 2: Show HN (post 24-48hrs after r/ClaudeAI, Tuesday/Wednesday 9-11am PT)

**Title:**

> Show HN: codebase-context – Gives AI agents pattern evidence from your actual codebase (local MCP)

**Author first comment:**

```
The problem: AI coding agents are generic. Your codebase is specific. Every team has patterns that
evolved over time, migrations that are halfway done, internal libraries that replaced third-party ones.
None of that is in the model's training data, and most of it is too implicit for CLAUDE.md rules.

codebase-context indexes your codebase and surfaces three kinds of evidence on every search:

1. Pattern adoption — scans your actual code for what's used at what frequency, with trend direction
   (Rising/Declining from git recency). "87% of your services use X. 13% use the legacy approach, it's
   declining." Not rules. Evidence from your code.

2. Team decisions — record once, surfaces automatically in search results. Conventional commits
   (refactor:, fix:, migrate:) auto-extract too. Confidence decay so stale decisions get flagged.

3. Edit readiness — before touching something, the agent sees caller coverage, pattern alignment,
   and whether retrieval quality is good enough to trust. If not, ready: false. No guessing on thin
   evidence.

Tech: hybrid search (Fuse.js + local embeddings, Hugging Face Transformers.js), RRF fusion (k=60),
Tree-sitter AST chunking for 10 languages (TypeScript, Python, Go, Rust, Java, Kotlin, C/C++, C#),
generic chunking for 30+, cross-encoder stage-2 reranker (ambiguity-triggered), LanceDB cosine
distance. Fully local.

Eval harness ships with the repo — run it yourself on angular-spotify (public TypeScript codebase):

    npm run eval -- /path/to/angular-spotify

GitHub: https://github.com/PatrickSys/codebase-context
npm: npx -y codebase-context /path/to/project
```

---

## Reddit Post 3: r/LocalLLaMA (post after r/ClaudeAI gets traction, or same day as HN)

**Title:**

> Built an offline-first MCP that indexes your codebase and shows AI agents what your team actually codes like — no API calls, all local

**Body:**

```
Fully offline MCP server that gives AI coding agents structured evidence from your codebase.
Tree-sitter AST parsing for 10 languages (TS, Python, Go, Rust, Java, Kotlin, C/C++, C#),
generic indexing for 30+. Local embeddings (Hugging Face Transformers.js), LanceDB vector
storage. Code never leaves your machine.

What it surfaces on every search: pattern adoption percentages with trend direction (Rising/Declining),
team decisions and conventional-commit memories with confidence decay, caller relationships from the
import graph, and an edit-readiness check that blocks edits when evidence is thin. Not rules you
wrote — evidence derived from your actual code.

One line to set up with Claude Code:

    claude mcp add codebase-context -- npx -y codebase-context /path/to/project

Also works with Claude Desktop, Cursor, VS Code Copilot, Windsurf, Codex.

GitHub: https://github.com/PatrickSys/codebase-context

Full story in [link to r/ClaudeAI post].
```

---

## Reddit Post 4: r/programming (ONLY if r/ClaudeAI gets >100 upvotes)

Adapt the HN post. Lead with the technical architecture (RRF, Tree-sitter, cross-encoder).
This audience is skeptical of AI tools — lead with engineering, not pain points.

---

## Reddit Post 5: r/cursor (same day as r/ClaudeAI or day after)

**Title:**

> Built an MCP that shows Cursor what your team actually codes like — patterns, adoption %, and edit-readiness checks

**Body:** Short version of r/ClaudeAI post. Emphasize `.cursor/mcp.json` setup (3 lines). Link to GitHub.

---

## Reddit Post 6: r/CodingWithAI (same timing as r/cursor)

Adapt r/ClaudeAI post. More general audience — don't assume CLAUDE.md knowledge. Lead with
"every AI PR review has the same problem."

---

## Registry Submissions (parallel with Reddit — 60 min total, passive forever)

| Registry | URL | Status |
|---|---|---|
| Official MCP Registry | https://modelcontextprotocol.io/registry/quickstart | [ ] |
| awesome-mcp-servers | https://github.com/punkpeye/awesome-mcp-servers | [ ] |
| Smithery | https://smithery.ai/submit | [ ] |
| glama.ai | https://glama.ai/mcp/servers/submit | [ ] |
| mcpservers.org | submission form on site | [ ] |
| Gemini CLI extensions | https://geminicli.com/extensions/ | [ ] |

---

## Launch Sequence

1. Fix all BLOCKER items at top of this file
2. Take screenshots, add to `docs/assets/`
3. Submit to registries (one-time, parallel)
4. Post r/ClaudeAI: Thursday evening 6-9pm ET
5. Post r/cursor + r/CodingWithAI: same day or day after
6. Post Show HN: following Tuesday/Wednesday 9-11am PT
7. Post r/LocalLLaMA: day of or after HN
8. r/programming: only if r/ClaudeAI >100 upvotes

---

## What Real Traction Looks Like

- **r/ClaudeAI**: comments asking "how does it handle X language" = real interest
- **HN**: 10+ upvotes in first 2 hours or it's buried
- **Real signal**: someone opens a non-trivial issue or asks about implementation
- **npm downloads**: check week-over-week delta after launch
- **Stars**: 10-50 from r/ClaudeAI; 50-300 if HN reaches front page
