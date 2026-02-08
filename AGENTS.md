# Agent Instructions

## Project Constraints

These are non-negotiable. Every PR, feature, and design decision must respect them.

- **Zero-infra**: Everything runs locally via `npx`. No Docker, no GPU, no cloud services required. API keys (OpenAI, etc.) are opt-in alternatives, never requirements.
- **Language/framework agnostic**: The core must work for any codebase. Angular is the first specialized analyzer, but search, indexing, chunking, memory, and patterns must not assume a specific language or framework.
- **Privacy-first**: Code never leaves the machine unless the user explicitly opts into a cloud embedding provider.
- **Small download footprint**: Dependencies should be reasonable for an `npx` install. Multi-hundred-MB downloads need strong justification.
- **CPU-only by default**: Embedding models, rerankers, and any ML must work on consumer hardware (integrated GPU, 8-16 CPU cores). No CUDA/GPU assumptions.
- **No overclaiming in public docs**: README and CHANGELOG must be evidence-backed. Don't claim capabilities that aren't shipped and tested.
- **internal-docs is private**: Never commit `internal-docs/` pointer changes unless explicitly intended. The submodule is always dirty locally; ignore it.

## Codebase Context

**At start of each task:** Call `get_memory` to load team conventions.

**CRITICAL:** When user says "remember this" or "record this":

- STOP immediately and call `remember` tool FIRST
- DO NOT proceed with other actions until memory is recorded
- This is a blocking requirement, not optional

## Internal Documentation (Submodule)

This repository uses a private git submodule for internal notes.

- **Path**: `internal-docs/`
- **Repo**: `https://github.com/PatrickSys/codebase-context-internal.git`

### Quick Setup

```bash
git clone --recurse-submodules https://github.com/PatrickSys/codebase-context.git
```

### Syncing

```bash
git pull --recurse-submodules
git submodule update --remote --merge
```

### Privacy

The `internal-docs` repository is private. It returns a 404 to unauthenticated users. Access requires a GitHub PAT or SSH keys with repository permissions.
