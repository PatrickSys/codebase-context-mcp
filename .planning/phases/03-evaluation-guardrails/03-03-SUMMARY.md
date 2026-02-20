---
phase: 03-evaluation-guardrails
plan: 03
subsystem: testing
tags: [eval, harness, cli, vitest, reporting]
requires:
  - phase: 03-evaluation-guardrails
    provides: frozen fixtures and regression guardrails from plans 01-02
provides:
  - Shared eval harness module in src/eval used by tests and CLI
  - Multi-codebase eval runner with per-codebase and combined metrics output
  - npm run eval workflow that builds before importing dist
affects: [phase-05-ast-aligned-chunking, phase-09-search-quality, docs-capabilities]
tech-stack:
  added: []
  patterns: [shared eval scoring utilities, dual-codebase CLI evaluation]
key-files:
  created:
    - src/eval/types.ts
    - src/eval/harness.ts
  modified:
    - tests/eval-harness.test.ts
    - scripts/run-eval.mjs
    - package.json
key-decisions:
  - "Consolidate eval scoring/reporting into src/eval so test and CLI outputs stay aligned."
  - "Treat --skip-reindex as best effort: if index artifacts are missing, auto-build the index to keep eval runnable from clean checkout."
patterns-established:
  - "Eval reports always print both wins and failures with expected vs actual top-3 evidence."
  - "Runner supports fixture-a/fixture-b overrides for offline deterministic verification."
requirements-completed: [EVAL-01]
duration: 5 min
completed: 2026-02-20
---

# Phase 03 Plan 03: Shared Eval Harness + Multi-Codebase CLI Summary

**Shared eval scoring/reporting now lives in `src/eval`, and `npm run eval -- <codebaseA> <codebaseB>` runs per-codebase plus combined reports with honest wins/failures output.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-20T18:45:32Z
- **Completed:** 2026-02-20T18:50:41Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added reusable `evaluateFixture`, `summarizeEvaluation`, and `formatEvalReport` in `src/eval/harness.ts` with shared eval types in `src/eval/types.ts`.
- Migrated `tests/eval-harness.test.ts` to consume shared harness logic while preserving frozen-fixture validation for both angular and controlled fixtures.
- Upgraded `scripts/run-eval.mjs` for one or two codebases, `--fixture-a/--fixture-b`, `--help`, combined summary output, and package-version display.
- Added `npm run eval` script that builds first so dist imports work from clean checkout.

## Task Commits

Each task was committed atomically:

1. **Task 1: Move eval harness logic into `src/eval/` and reuse from tests** - `5c5319b` (feat)
2. **Task 2: Upgrade runner to multi-codebase CLI and add `npm run eval`** - `b065042` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `src/eval/types.ts` - Shared fixture/query/result/summary type contracts for eval harness and runner.
- `src/eval/harness.ts` - Centralized evaluation scoring and report formatting with wins/failures sections.
- `tests/eval-harness.test.ts` - Harness unit tests updated to consume shared module and enforce frozen fixture invariants.
- `scripts/run-eval.mjs` - Multi-codebase CLI with fixture overrides, combined summary, and clean-checkout-safe behavior.
- `package.json` - Adds `npm run eval` entrypoint (`pnpm run build && node scripts/run-eval.mjs`).

## Decisions Made
- Centralized harness logic under `src/eval` to prevent scoring/report drift between tests and CLI runs.
- Kept the runner explicit about failures by printing query id/text, expected patterns, and top-3 actual paths.
- Added skip-reindex fallback to auto-index when artifacts are missing so the eval command remains operable in fresh environments.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Handled missing index artifacts when `--skip-reindex` is used**
- **Found during:** Task 2 verification (offline two-codebase smoke run)
- **Issue:** `--skip-reindex` failed on clean state with missing `.codebase-context` artifacts, causing index corruption errors before evaluation.
- **Fix:** Added index artifact detection and automatic reindex fallback when skip is requested without an existing index.
- **Files modified:** scripts/run-eval.mjs
- **Verification:** `npm run eval -- tests/fixtures/codebases/eval-controlled tests/fixtures/codebases/eval-controlled --fixture-a=tests/fixtures/eval-controlled.json --fixture-b=tests/fixtures/eval-controlled.json --skip-reindex --no-rerank`
- **Committed in:** b065042

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Deviation kept the eval workflow usable from clean checkout without changing planned scope.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Phase 03 now has frozen fixtures, regression guardrails, and a reusable multi-codebase eval command.
Phase is complete and ready for transition to Phase 04 grammar assets/loader work.

---
*Phase: 03-evaluation-guardrails*
*Completed: 2026-02-20*

## Self-Check: PASSED
