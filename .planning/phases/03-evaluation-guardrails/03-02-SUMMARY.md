---
phase: 03-evaluation-guardrails
plan: 02
subsystem: testing
tags: [tree-sitter, vitest, unicode, parser-reset, indexing]
requires:
  - phase: 02-tree-sitter
    provides: parse-error fallback and symbol-aware chunking baseline
provides:
  - Unicode slicing regression coverage for symbol extraction
  - Large file and generated file skip regression coverage
  - Parser timeout/reset and cleanup regression coverage
affects: [phase-05-ast-aligned-chunking, phase-09-search-quality]
tech-stack:
  added: []
  patterns: [utf8-safe extraction guardrails, parser cache eviction on failure]
key-files:
  created:
    - tests/tree-sitter-unicode-slicing.test.ts
    - tests/tree-sitter-cleanup.test.ts
    - tests/indexer-large-file-skip.test.ts
  modified:
    - src/utils/tree-sitter.ts
key-decisions:
  - "Set Tree-sitter timeout via setTimeoutMicros when available, but fail open if timeout API signature differs across runtimes."
  - "Include export_statement parent range for symbol content so exported declarations remain complete in extracted chunks."
patterns-established:
  - "Guardrail tests use local grammars/mocks only and remain network-free."
  - "Parser failures evict cache entries to avoid poisoning subsequent parses."
requirements-completed: [EVAL-02]
duration: 4 min
completed: 2026-02-20
---

# Phase 03 Plan 02: Regression Guardrails Summary

**Tree-sitter extraction now has Unicode-safe guards with parser reset/cleanup hardening, backed by focused regressions for Unicode boundaries, parse failure recovery, and large-file skipping.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-20T18:31:16Z
- **Completed:** 2026-02-20T18:36:04Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Hardened `extractTreeSitterSymbols` with UTF-8 extraction path, 1 MiB parse budget guard, timeout wiring, and parser cache eviction/reset on failures.
- Added regression tests that lock Unicode slicing behavior, parser cleanup/reset behavior, and large/generated file skip behavior.
- Verified all new regressions pass with network-free Vitest execution.

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden Tree-sitter extraction for Unicode + reset behavior** - `375a48f` (fix)
2. **Task 2: Add regression tests for Unicode slicing, large file skipping, and cleanup/reset** - `a1c71de` (fix)

**Plan metadata:** `58adead`

## Files Created/Modified
- `src/utils/tree-sitter.ts` - Adds parse guards, timeout wiring, parser cache eviction/reset, and export-range-aware symbol extraction.
- `tests/tree-sitter-unicode-slicing.test.ts` - Reproduces and protects against Unicode boundary symbol slicing corruption.
- `tests/tree-sitter-cleanup.test.ts` - Mocks parser behavior to verify `tree.delete()` cleanup and parser reset/eviction paths.
- `tests/indexer-large-file-skip.test.ts` - Validates oversize regular and generated files are skipped without breaking indexing.

## Decisions Made
- Used a best-effort timeout hook: call `setTimeoutMicros` when present, but do not fail extraction if timeout API wiring differs across parser builds.
- Expanded symbol content range to include `export_statement` parent nodes, preserving complete exported declaration headers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed exported declaration truncation under Unicode boundary conditions**
- **Found during:** Task 2 (Unicode regression execution)
- **Issue:** Byte-slice extraction produced incomplete exported declaration headers in a Unicode-preceded file.
- **Fix:** Added compatibility extraction fallback and export parent-range capture in `buildSymbol`.
- **Files modified:** src/utils/tree-sitter.ts
- **Verification:** `pnpm vitest run tests/tree-sitter-unicode-slicing.test.ts`
- **Committed in:** a1c71de

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Deviation was required to satisfy the guardrail objective and keep extraction behavior correct across runtime offset semantics.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Regression coverage for EVAL-02 failure surfaces is in place and passing.
Ready for 03-03 shared eval harness and multi-codebase `npm run eval` wiring.

---
*Phase: 03-evaluation-guardrails*
*Completed: 2026-02-20*

## Self-Check: PASSED
