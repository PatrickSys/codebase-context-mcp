---
phase: 03-evaluation-guardrails
plan: 01
subsystem: testing
tags: [eval, fixtures, vitest, guardrails]
requires:
  - phase: 02-tree-sitter
    provides: parse-fallback-safe indexing and symbol reference baseline
provides:
  - second frozen eval fixture committed in-repo
  - deterministic local codebase for offline eval runs
  - fixture docs updated with controlled path example
affects: [phase-03-plan-03, eval-runner, regression-reporting]
tech-stack:
  added: []
  patterns: [frozen fixture metadata with frozenDate and anti-tuning notes, filename-substring expected patterns]
key-files:
  created:
    - tests/fixtures/eval-controlled.json
    - tests/fixtures/codebases/eval-controlled/package.json
    - tests/fixtures/codebases/eval-controlled/src/auth/auth.service.ts
    - tests/fixtures/codebases/eval-controlled/src/http/auth.interceptor.ts
    - tests/fixtures/codebases/eval-controlled/src/player/player-api.ts
    - tests/fixtures/codebases/eval-controlled/src/state/album.store.ts
    - tests/fixtures/codebases/eval-controlled/src/storage/local-storage.service.ts
  modified:
    - tests/fixtures/README.md
key-decisions:
  - "Use a tiny in-repo TypeScript fixture codebase so eval tests can run offline without cloning external repos."
  - "Keep expected patterns as path/filename substrings to avoid brittle absolute-path coupling."
patterns-established:
  - "Frozen eval fixtures must include frozenDate plus anti-tuning notes."
  - "Controlled eval queries mirror production categories: exact-name, conceptual, multi-concept, structural."
requirements-completed: [EVAL-01]
duration: 1 min
completed: 2026-02-20
---

# Phase 3 Plan 1: Controlled Eval Fixture Summary

**Added a deterministic in-repo eval codebase and frozen 20-query controlled fixture to enable multi-codebase evaluation without network dependency.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-20T18:33:09Z
- **Completed:** 2026-02-20T18:33:33Z
- **Tasks:** 1
- **Files modified:** 8

## Accomplishments
- Added `tests/fixtures/codebases/eval-controlled/` with focused auth/interceptor/player/store/storage files for deterministic intent mapping.
- Added `tests/fixtures/eval-controlled.json` with 20 frozen queries across all four eval categories.
- Updated `tests/fixtures/README.md` with the controlled fixture listing and a no-network local eval invocation example.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add controlled in-repo eval codebase + frozen fixture** - `46736ed` (feat)

## Files Created/Modified
- `tests/fixtures/eval-controlled.json` - Frozen controlled fixture with >=20 category-diverse queries.
- `tests/fixtures/codebases/eval-controlled/src/auth/auth.service.ts` - Deterministic auth token/session behavior.
- `tests/fixtures/codebases/eval-controlled/src/http/auth.interceptor.ts` - Authorization header injection + 401 handling.
- `tests/fixtures/codebases/eval-controlled/src/player/player-api.ts` - Player API operations for conceptual eval intents.
- `tests/fixtures/codebases/eval-controlled/src/state/album.store.ts` - Store-style state, dispatch, and selector methods.
- `tests/fixtures/codebases/eval-controlled/src/storage/local-storage.service.ts` - Local persistence abstraction used by auth service.
- `tests/fixtures/codebases/eval-controlled/package.json` - Fixture package metadata.
- `tests/fixtures/README.md` - Documents controlled fixture usage path and command.

## Decisions Made
- Used an in-repo controlled codebase instead of generated runtime fixtures to keep eval reproducible and versioned.
- Kept fixture matching based on path substrings rather than absolute paths for portability across machines.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
Ready for `03-02-PLAN.md` and `03-03-PLAN.md` to add regression guardrails and shared multi-codebase harness wiring.

## Self-Check: PASSED

- FOUND: `.planning/phases/03-evaluation-guardrails/03-01-SUMMARY.md`
- FOUND: `tests/fixtures/eval-controlled.json`
- FOUND: `tests/fixtures/codebases/eval-controlled/src/auth/auth.service.ts`
- FOUND: `46736ed`

---
*Phase: 03-evaluation-guardrails*
*Completed: 2026-02-20*
