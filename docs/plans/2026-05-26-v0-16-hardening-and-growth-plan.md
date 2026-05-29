# v0.16 Hardening And Growth Plan

**Date:** 2026-05-26

**Branch:** `v0.16`

## Purpose

v0.16 should not be a feature grab. The codebase already has a strong product wedge, but its quality signals are not yet trustworthy enough to support faster iteration.

This plan prioritises:

1. truthful tooling and verification
2. lower maintenance cost in the extension host
3. a tighter SQL formatting contract
4. telemetry that matches the privacy claim
5. dependency reduction where the repo evidence supports it

## Current Baseline

Current local status after the completed v0.16 hardening slices:

- `npm run compile:check` passes
- `npm run test:pure` passes
- `npm run test:csv` passes
- `npm run lint` passes
- `npm test` passes on Windows
- `npm run test:pure` currently reports 72 passing tests
- `npm run test:csv` currently reports 18 passing tests
- `npm test` currently reports 99 passing tests

## Progress Snapshot

### Completed

- Phase 1: truthful baseline
- Phase 2: quality gate repair
- Phase 3: extension-host refactor
- Phase 4: SQL contract hardening
- dependency reduction slice
- warning clean-up for direct Mocha runs and VS Code host noise

### In Progress

- Phase 5: telemetry and privacy alignment

### Not Started

- Phase 6: selective product expansion

## Scope Boundary

This plan is for quality, maintainability and product readiness. It is not a broad expansion into unrelated SQL tooling.

The immediate goal is to make the current extension reliable enough that future product work lands on a defendable base.

## Phase 1: Re-establish A Truthful Baseline

**Objective:** make the repo honest about what works, what does not, and which scripts are authoritative.

**Status:** completed

### Tasks

- Confirm the authoritative developer workflow in `package.json`, `README.md` and `CLAUDE.md`.
- Record the current pass/fail baseline for compile, lint, pure tests, CSV tests and extension-host tests.
- Decide which coverage path is canonical and which helper scripts are legacy.
- Add a short project note for v0.16 that explicitly states the branch intent and exit criteria.

### Deliverables

- This plan file
- A concise baseline note in the repo if needed during execution

### Exit Criteria

- One authoritative build and test path is defined
- Known failures are documented, not implied away

### Outcome

- The repo now has one supported quality-gate path built around `npm run lint`, `npm run compile:check`, `npm run test:pure`, `npm run test:csv` and `npm test`.
- The stale pre-work baseline has been replaced by a verified passing baseline.

## Phase 2: Repair The Quality Gate

**Objective:** make the quality gate meaningful before any substantial refactor or feature work.

**Status:** completed

### Tasks

- Fix the current ESLint failures in `src/extension.ts`, `src/telemetry/supabase-telemetry.ts` and `src/telemetry/types.ts`.
- Repair `src/test/runTest.ts` so `npm test` works on Windows with the local VS Code installation or a downloaded test runtime.
- Add at least a small set of genuine extension-host tests so `npm test` proves real behaviour, not just compilation.
- Remove or archive duplicate coverage helpers once the canonical coverage path is confirmed.
- Eliminate the current Mocha module-mode warning if it remains relevant after the test path is cleaned up.

### Verification

- `npm run lint`
- `npm run compile:check`
- `npm run test:pure`
- `npm run test:csv`
- `npm test`

### Exit Criteria

- All listed verification commands pass locally
- Extension-host tests are no longer nominal
- Coverage has one supported entrypoint

### Outcome

- `src/test/runTest.ts` was repaired so the extension-host suite runs correctly on Windows.
- The extension-host test surface now includes real command-path behaviour, not just compilation.
- Duplicate legacy coverage helper scripts were removed.
- The direct Mocha warning and benign VS Code host warning noise were cleaned up so failures are easier to trust.

## Phase 3: Refactor The Extension Host

**Objective:** cut the maintenance cost of the host layer without changing product behaviour.

**Status:** completed

### Tasks

- Break `src/extension.ts` into smaller modules:
  - command registration
  - clipboard and selection ingestion
  - statement preparation workflow
  - UI prompt and preview handling
  - telemetry and rating prompts
- Remove duplicated logic across selection, direct paste and column-paste flows.
- Keep `src/pure.ts` as the logic core and make the host a thinner orchestration layer.
- Add tests around extracted non-VS Code orchestration where practical.

### Verification

- Existing tests still pass
- New shared helpers are covered by unit tests where they do not depend on VS Code APIs

### Exit Criteria

- `src/extension.ts` is materially smaller and easier to reason about
- Shared workflow logic exists once, not several times

### Outcome

- The host layer is now split across focused modules for input preparation, statement preparation, command effects, status-bar management and rating prompts.
- `src/extension.ts` is now primarily activation and orchestration glue instead of owning every workflow detail inline.
- Focused helper-module tests were added around the new seams.

## Phase 4: Harden The SQL Contract

**Objective:** stop relying on accidental regex behaviour for data that users trust in queries.

**Status:** completed

### Tasks

- Define and document exact behaviour for:
  - `IN (...)` or `NOT IN (...)` pasted fragments
  - leading-zero identifiers
  - whitespace-only values
  - `NULL` handling
  - date and datetime detection
  - malformed date-like inputs
  - mixed text and numeric datasets
- Replace tests that currently encode questionable behaviour with tests that reflect intended semantics.
- Add adversarial test cases for real copy-paste inputs from editors, spreadsheets and query results.
- Decide where the product should refuse ambiguous input instead of being silently “helpful”.

### Verification

- `npm run test:pure`
- targeted new test cases for parser and formatter edge cases

### Exit Criteria

- The core SQL formatting contract is explicit, documented and test-backed
- Ambiguous behaviour is intentional, not accidental

### Outcome

- SQL `IN (...)` and `NOT IN (...)` paste handling is materially stricter and more realistic.
- Leading-zero identifiers, quoted values, malformed SQL fragments, whitespace handling and date-like inputs now have explicit test-backed behaviour.
- Table and header inference is more conservative, so copied data is less likely to lose its first real value through accidental header guessing.

## Phase 5: Align Telemetry With The Privacy Claim

**Objective:** make the implementation defensible against the repo’s own privacy statement.

**Status:** in progress

### Tasks

- Review telemetry fields against `docs/PrivacyStatement.md`.
- Replace weak anonymous identifier generation with an actual one-way hash approach.
- Fix Sydney timestamp handling so daylight saving time is represented correctly.
- Remove telemetry fields that do not clearly earn their keep.
- Document the effective telemetry schema and controls in plain language.

### Verification

- code review against `docs/PrivacyStatement.md`
- targeted tests for utility functions introduced during the telemetry clean-up

### Exit Criteria

- The docs and implementation no longer contradict each other
- Telemetry is minimal, deliberate and explainable

### Note

- This phase has now been reopened after the host-hardening commit so the telemetry and privacy work can land as its own bounded slice.

## Phase 6: Product Expansion From A Stronger Base

**Objective:** use the cleaned foundation for one meaningful product improvement rather than broadening scope blindly.

**Status:** not started

### Candidate Directions

- richer SQL filter generation around the current `IN` / `NOT IN` core
- a reusable core package or CLI built from the pure logic layer
- better workflows for pasted table data
- more deliberate UX for analyst-heavy usage patterns

### Selection Rule

Pick one expansion based on:

- support cost after Phases 1 to 5
- real user value
- telemetry and issue evidence
- how little extra architectural debt it introduces

### Exit Criteria

- One visible product improvement lands on top of a stable foundation

## Recommended Order

1. Phase 1: truthful baseline
2. Phase 2: quality gate repair
3. Phase 3: extension-host refactor
4. Phase 4: SQL contract hardening
5. Phase 5: telemetry and privacy alignment
6. Phase 6: selective product expansion

## Dependency Reduction Audit

This section is intentionally evidence-based. A dependency is only a good removal candidate if the repo does not currently use it or if the remaining usage is legacy tooling we plan to retire.

### Strong Removal Candidates

- `uuid`
  - Declared in `package.json`
  - No usage found in `src` or repo-root helper scripts
  - Session IDs are already generated with `crypto.randomBytes`

- `minimatch`
  - Declared in `package.json`
  - No direct usage found in the repo
  - Likely leftover from earlier tooling experiments

- `minimist`
  - Declared in `package.json`
  - No direct usage found in the repo
  - Also appears in `overrides`, which should be revisited if the direct dependency is removed

- `mkdirp`
  - Declared in `package.json`
  - No direct usage found in the repo
  - All current directory creation seen in repo scripts uses `fs.mkdirSync(..., { recursive: true })`

- `cross-env`
  - Declared in `devDependencies`
  - No direct usage found in scripts or source

- `istanbul-lib-coverage`
  - Declared in `devDependencies`
  - No direct usage found in source or scripts
  - Looks like leftover coverage experimentation

- `source-map-support`
  - Declared in `devDependencies`
  - No direct usage found in source or scripts

### Conditional Removal Candidates

- `node-fetch`
  - Used directly in `src/extension.ts` to polyfill `fetch`
  - Could become removable only if we explicitly target a VS Code runtime where native `fetch` is guaranteed and we are comfortable tightening compatibility assumptions
  - Not a safe “remove now” candidate under the current support stance

### Keep

- `@supabase/supabase-js`
  - Actively used by the telemetry collector

- `glob`
  - Used by the extension test loader

- `esbuild`
  - Used by the build script

- `@vscode/test-electron`
  - Required by the extension-host test runner

### Dependency Reduction Work Item For v0.16

Status: completed for the strong candidates.

What landed:

1. removed the strong direct dependency candidates
2. refreshed `package-lock.json`
3. kept `node-fetch` as a deliberate compatibility hold
4. re-verified the full local quality gate after the cleanup

## Definition Of Ready

v0.16 is ready to start when:

- the branch exists
- the execution order is documented
- the quality-gate failures are explicit
- dependency reduction candidates are separated into safe and conditional groups

This condition has been met and exceeded. The branch is now in a stabilised post-hardening state rather than a pre-start state.

## Starting Move

The original starting move has been completed.

The next bounded move should be one of:

1. prepare the current host-hardening and SQL-contract work as a review or commit slice
2. reopen Phase 5 and do telemetry/privacy alignment as its own deliberate pass
3. choose one small product expansion now that the base is materially safer
