# Plan Phase 4

## Main Goal

Migrate the Bklit UI charts to Tanstack Charts by:

- Exact same frontend design and interactivity
- Make backend tanstack charts native
- Keep same components API (seemless change from Legacy Bklit to tanstack charts)

## Phase 4 Goal

We have migrated all charts and utilities. This plan phase 4's goal is to:

- Refactor out bklit ui or custom code that can be handled via tanstack native functions
- Remove redundancies, or uncessary complexity
- Centralize duplicated logic
- Review component apis parity with legacy

**Macro structure:** Research (4.1) -> Synthesis (4.2) -> Plan (4.3) -> Implement (4.4)

## How to Work

You are the key decision maker and manager. You focus on orchestrating sub agents so you can:

- Explore codebases
- Follow up on questions
- Implement code changes

You want to be as efficient as possible.

How to launch executor-agents: Read `/cmd-executor` skill

---

## Phase 4.1: Research

### 4.1.1 — Placeholders

Create `docs/phase-4` benchmarks, logs and progress placeholders files.

### 4.1.2 — Taxonomy

List the migrated Parts: charts, add-ons and utilities in the migrated codebase, including the `internal/` modules (grouped is fine — most centralization/redundancy findings live there). Write the `research/phase-4/taxonomy` file (Keep text concise and terse, strucutre it with a table).

### 4.1.3 — Standardized Report Layout

Read the 4.1.4 task to understand what we want to research and create a standardized report layout for all executor agents to follow. This layout should keep text concise and terse, strucutring things with a table. At the end of the runtime in 4.1.4.1, the executor agent wirtes the standardized report in `research/phase-4/(part).md`.

Report layout:

- **Header:** part name, file(s), legacy bklit source file(s)
- **Feature summary:** 2-3 lines prose
- **Public API table:** `prop/export | type | legacy parity (same / renamed / missing / extra)`
- **Inventory table:** `Item | Kind | Origin | Impl | TanStack-native candidate? | Notes`
  - Kind: component / hook / context / mark / overlay / util fn / constant / CSS class / type
  - Origin (where the behavior comes from): BKLIT (parity requirement) / TANSTACK (default) / CUSTOM (new addition)
  - Impl (how it's implemented): TS-NATIVE / CUSTOM-ON-TS / CUSTOM
  - TanStack-native candidate?: yes / maybe / no — cheap guess, pre-seeds 4.2.1.4
  - Include: inlined constants/magic values, side-effect channels (WAAPI, DOM mutation, listeners), contexts/hooks, CSS classes used from styles.css
- **Imports list:** `internal/` modules this part imports
- **Deviations:** TODOs, workarounds, known parity gaps found while reading

### 4.1.4 — Dispatch Report Agents

For each of the listed part in the taxonomy (Batch 5 at a time):

- **4.1.4.1** — Dispatch a executor agent to write the 4.1.3 report for the part
- **4.1.4.2** — SHARED vs UNIQUE is a *shareability* verdict, NOT an import count, and is NOT decided per-agent: after all reports land, dispatch one executor agent (separate runtime) to write `research/phase-4/usage-matrix.md` (internal module -> parts using it). Import-grep evidence (script) stays as a supporting column, but the verdict is semantic: SHARED = logic already shared by 2+ parts, OR duplicated/parallel logic that can be refactored and centralized to be shared across parts (naming the counterpart parts/modules as evidence); UNIQUE = inherently part-specific, non-shareable logic/patterns. ORPHAN (0 importers) stays flagged as a dead-code signal alongside the verdict.
- **4.1.4.3** — TanStack-native candidate verification: per part, dispatch an unbiased, independent executor agent (fresh runtime, not the report author) that goes item by item through the part report's Inventory table and exhaustively searches the TanStack Charts source for native equivalents. It appends its conclusion to the Notes column in a terse, concise way (`TS-check: ...`), including when it contradicts the recorded yes/maybe/no verdict. Reports stay otherwise untouched; verdict corrections are consumed by 4.2.1.4.

---

## Phase 4.2: Synthesis

### 4.2.1 — Synthesis Reports

Given the PHASE 4 GOAL and MAIN GOAL now we synthesize the research done `research/phase-4/synthesis/` folder. Dispatch ONE executor agent PER file below (4 agents, parallel runtimes — each lens reads the same reports with a different question). Each agent goes through the 4.1.4 reports + usage-matrix, also if needed he can review the codebase. After full reviewal he should flag and list all occurrences that apply in concise and terse report, strucutring things with a table.

- **4.2.1.1** — `research/phase-4/synthesis/parity.md`: Review migrated parts apis parity with legacy
- **4.2.1.2** — `research/phase-4/synthesis/centralize.md`: Centralize duplicated logic
- **4.2.1.3** — `research/phase-4/synthesis/redundancies.md`: Remove redundancies, uncessary complexity, dead code
- **4.2.1.4** — `research/phase-4/synthesis/tanstack.md`: Refactor out bklit ui or custom code that can be handled via tanstack native functions

---

## Phase 4.3: Plan

### 4.3.1 — Final Synthesis

Review the 4.2 synthesis files and merge everything into one go-to-plan: `research/phase-4/go-to-plan.md` (concise, terse, strucutred task file).

- Take the time to verify open questions, either through codebase research (Migrated, Bklit or Tanstack), read offcial docs using context7 mcp or web search as fallback.
- Be effcient, less is more, look for native tanstack solutions and not custom wrappers and keep the MAIN GOAL in mind.
- Parity gaps: mark each one FIX or ACCEPT. Accepted deviations get logged in `docs/LOG.md` (D-number convention).
- Each task carries: affected files, acceptance criteria, batch.

### 4.3.2 — Batch Ordering

Order matters, launch an executor agent to review and update your plan and group tasks and orger groups in a way we can be effcient and parallleize if with seperate agents .

---

## Phase 4.4: Implement

### 4.4.1 — Baseline

Baseline (BEFORE any change): capture in `docs/phase-4/benchmarks` (the 4.1.1 placeholders):

- bench/app benchmark run
- typecheck + build status
- visual/behavior reference pass per chart in the showcase (screenshots or manual checklist) — "exact same design and interactivity" must be checkable, not vibes

### 4.4.2 — Implementation

Implement batch by batch (executor agents), ordering from 4.3.2.

### 4.4.3 — Gate

Gate after each batch: typecheck + build + bench compare vs baseline + spot-check affected charts. Fix or revert before starting the next batch. Tick completed tasks in `docs/phase-4` progress file.

### 4.4.4 — Staleness Rule

Once implementation starts, `go-to-plan.md` is the source of truth. Do not re-consult 4.1 reports for code already touched — they describe pre-refactor state.

### 4.4.5 — Final Pass

Full build + bench compare + parity spot-check of ALL charts vs 4.4.1 baseline.

---

## Definition of Done

All go-to-plan tasks closed or skipped-with-reason (logged in `docs/LOG.md`), typecheck + build + bench pass, final spot-check matches baseline.
