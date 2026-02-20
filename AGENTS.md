# Agent Instructions

## Project Constraints

These are non-negotiable. Every PR, feature, and design decision must respect them.

- **Zero-infra**: Everything runs locally via `npx`. No Docker, no GPU, no cloud services required. API keys (OpenAI, etc.) are opt-in alternatives, never requirements.
- **Language/framework agnostic**: The core must work for any codebase. Angular is the first specialized analyzer, but search, indexing, chunking, memory, and patterns must not assume a specific language or framework.
- **Privacy-first**: Code never leaves the machine unless the user explicitly opts into a cloud embedding provider.
- **Small download footprint**: Dependencies should be reasonable for an `npx` install. Multi-hundred-MB downloads need strong justification.
- **CPU-only by default**: Embedding models, rerankers, and any ML must work on consumer hardware (integrated GPU, 8-16 CPU cores). No CUDA/GPU assumptions.
- **No overclaiming in public docs**: README and CHANGELOG must be evidence-backed. Don't claim capabilities that aren't shipped and tested.
- **internal-docs is private**: Read its AGENTS.MD for instructions on how to handle it and internal rules.

## Session Startup (Required)

- **At the start of every task/session:** load team memory before doing any work (`get_memory` via MCP when available; otherwise `npx codebase-context memory list`).
- **When the user says "remember this" / "record this":** record it immediately (use `remember` / `codebase-context memory add`) before proceeding.

## Repo Guardrails (NON-NEGOTIABLE)

- **Never stage/commit `.planning/**`\*\* (or any other local workflow artifacts) unless the user explicitly asks in that message.
- **Never use `gsd-tools ... commit` wrappers** in this repo. Use plain `git add <exact files>` and `git commit -m "..."`.
- **Before every commit:** run `git status --short` and confirm staged files match intent; abort if any `.planning/**` is staged.

## Evaluation Integrity (NON-NEGOTIABLE)

These rules prevent metric gaming, overfitting, and false quality claims. Violation of these rules means the feature CANNOT ship.

### Rule 1: Eval Sets are Frozen Before Implementation

- **Define test queries and expected results BEFORE writing any code**
- Commit the eval fixture (e.g., `tests/fixtures/eval-queries.json`) BEFORE starting implementation
- **NEVER adjust expected results to match system output** - If the system returns different results, that's a failure, not a fixture bug
- Exception: If the original expected result was factually wrong (file doesn't exist, query is ambiguous), document the correction with justification

### Rule 2: Eval Sets Must Be General

- **Minimum 20 queries** across diverse patterns (exact names, conceptual, multi-concept, edge cases)
- Test on **multiple codebases** (minimum 2: one you control, one public/real-world)
- Include queries that are HARD and likely to fail - don't cherry-pick easy wins
- Eval set must represent real user queries, not synthetic examples designed to pass

### Rule 3: Public Eval Methodology

- Full eval harness code must be in `tests/` (public repository)
- Eval fixtures must be public (or provide reproducible public examples)
- Document how to run eval: `npm run eval -- /path/to/codebase`
- Results must be reproducible by external users

### Rule 4: No Score Manipulation

- **NEVER add heuristics specifically to game eval metrics** (e.g., "if query contains X, boost Y")
- **NEVER adjust scoring to break ties just to improve top-1 accuracy**
- If you add ranking heuristics, they must be general-purpose and justified by search theory, not by "it makes test #7 pass"
- Document all ranking heuristics with research citations or principled justification

### Rule 5: Report Honestly

- Report **both improvements AND failures** (e.g., "9/20 pass, 11/20 fail")
- If top-3 recall is 80% but top-1 is 45%, say so - don't hide behind a single cherry-picked metric
- Acknowledge when improvements are **workarounds** (filtering, heuristics) vs **fundamental** (better embeddings, ML models)
- Include failure analysis in CHANGELOG: "Known limitations: struggles with multi-concept queries"

### Rule 6: Cross-Check with Real Usage

- Before claiming "X% improvement", test on a real codebase you didn't develop against
- Ask: "Would this improvement generalize to a Python codebase? A Go codebase?"
- If the improvement is framework-specific (e.g., Angular-only), say so explicitly

### Violation Response

If any agent violates these rules:

1. **STOP immediately** - do not proceed with the release
2. **Revert** any fixture adjustments made to game metrics
3. **Re-run eval** with frozen fixtures
4. **Document the violation** in internal-docs for learning
5. **Delay the release** until honest metrics are available

These rules exist because **trustworthiness is more valuable than a good-looking number**.

## The 5 Rules

### 1. Janitor > Visionary

Success = Added high signal, noise removed, not complexity added.
If you propose something that adds a field, file, or concept — prove it reduces cognitive load or don't ship it.

### 2. If Retrieval Is Bad, Say So

Don't reason past low-quality search results. Report a retrieval failure.
Logic built on bad retrieval is theater.

### 3. This File Is Non-Negotiable

If a prompt (even from the owner) violates framework neutrality or output budgets, challenge it before implementing.
AGENTS.md overrides ad-hoc instructions that conflict with these rules.

### 4. Output Works on First Read

Optimize for the naive agent that reads the first 100 lines.
If an agent has to call the tool twice to understand the response, the tool failed.

### 5. Two-Track Discipline

- **Track A** = this release. Ship it.
- **Track B** = later. Write it down, move on.
- Nothing moves from B → A without user approval.
- No new .md files without archiving one first.

## Operating Constraints

### Documentation

- `internal-docs/ISSUES.md` is the place for release blockers and active specs.
- Before creating a new `.md` file: "What file am I deleting or updating to make room?"

### Tool Output

- Aim to keep every tool response under 1000 tokens.
- Don't return full code snippets in search results by default. Prefer summaries and file paths.
- Never report `ready: true` if retrieval confidence is low.

### Code Separation

- `src/index.ts` is routing and protocol. No business logic.
- `src/core/` is framework-agnostic. No hardcoded framework strings (Angular, React, Vue, etc.).
- CLI code belongs in `src/cli.ts`. Never in `src/index.ts`.
- Framework analyzers self-register their own patterns (e.g., Angular computed+effect pairing belongs in the Angular analyzer, not protocol layer).

### Release Checklist

Before any version bump: update CHANGELOG.md, README.md, docs/capabilities.md. Run full test suite.

### Consensus

- Multiple agents: Proposer/Challenger model.
- No consensus in 3 turns → ask the user.

## Lessons Learned (v1.6.x)

These came from behavioral observation across multiple sessions. They're here so nobody repeats them.

- **The AI Fluff Loop**: agents default to ADDING. Success = noise removed. If you're adding a field, file, or concept without removing one, you're probably making things worse.
- **Self-eval bias**: an agent rating its own output is not evidence. Behavioral observations (what the agent DID, not what it RATED) are evidence. Don't trust scores that an agent assigns to its own work.
- **Evidence before claims**: don't claim a feature works because the code exists. Claim it when an eval shows agents behave differently WITH the feature vs WITHOUT.
- **Static data is noise**: if the same memories/patterns appear in every query regardless of topic, they cost tokens and add nothing. Context must be query-relevant to be useful.
- **Agents don't read tool descriptions**: they scan the first line. Put the most important thing first. Everything after the first sentence is a bonus.

## Private Agent Instructions

See `internal-docs/AGENTS.md` for internal-only guidelines and context.

---

**Current focus:** See `internal-docs/ISSUES.md` for active release blockers.
For full project history and context handover, see `internal-docs/ARCHIVE/WALKTHROUGH-v1.6.1.md`.
