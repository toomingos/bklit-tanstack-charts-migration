# Phase 7 research index

Plan: `PLAN-phase-7.md` (root). Progress and decisions: `docs/phase-7/`.

| File | Role | Status |
|---|---|---|
| `00-independent-audit.md` | First audit of claims 1 and 2 after Phase 6, scores and fix plan | frozen input |
| `01-blocker-routes.md` | Routes for wipe reveal, polar states, provider layer, evidence, bundle | frozen input |
| `02-residual-routes.md` | Second-order gaps: nativeness, API, evidence, bundle, maintainability | frozen input |
| `03-final-routes.md` | Sweep via `surface.render`, sibling resource host, keyframe arrays, module count | frozen input; §1 route dropped by `08` §2 |
| `04-last-mile.md` | Evidence, bundle and maintainability to 10 | frozen input |
| `05-second-audit.md` | Independent re-audit of the routes | frozen input |
| `06-second-routes.md` | N-1..N-6, A-1..A-5 routes | frozen input; N-3 corrected by `08` §2 |
| `07-upstream-issues.md` | Issue drafts I1–I6 and the F-260 comment; issue numbers once filed (V0.5) | live |
| `08-synthesis.md` | Reasoning record: rulings R1–R10, corrections, vectors, work items, waves, definition of done | live, append-only after 7.1 |
| `09-native-definition-and-new-gaps.md` | Definition of native (ownership table, ten invariants), N-1..N-11, P-1..P-26 | reference |
| `10-parity-contract.md` | Claim-2 spec: export families, slots, package contract, exceptions, legacy tests | live, target for V1.6 / V3.7 / V4.2 |
| `go-to-plan.md` | Source of truth from 7.1: family × vector matrix, deletion list, collisions, waves, dispatch template | live |
| `11-refactor.md` | 7.4 triage table | written at 7.4 |

Read order for a new executor: `go-to-plan.md` → the item row in `08` §4 → `10` if the item
touches exports. `00`–`06` are evidence only; do not act on their routes.
