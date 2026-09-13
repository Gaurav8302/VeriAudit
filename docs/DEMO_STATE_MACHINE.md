# Demo State Machine

Implemented in `lib/demo/state-machine.ts`. Tests: `tests/demo-state.test.ts`.

The demo is a story, not a dashboard. One `state`, one `phase`. Scattered
booleans (`isSearching`, `showTrail`) are forbidden.

---

## 1. States

| State | Screen | Backend |
|---|---|---|
| `welcome` | One-line promise | none |
| `scenario_select` | Four scenario cards; financial marked hero | `GET /api/audits` |
| `running` | Staged progress (presentation) | `POST /api/audits/run` in flight |
| `result` | 12 / 9 / 3 + findings | run payload already held |
| `simulate_ready` | “Simulate the next 3 months” | none |
| `simulating` | Short “three months later” beat | `POST /api/simulation/start` |
| `history` | 55-row feed, newest first | simulation corpus |
| `investigation` | Boss question + search box | none yet |
| `search_results` | Ranked groups | `GET /api/search` |
| `reconstruction` | Audit as it stood | `GET/POST …/reconstruction` |
| `trail` | Causal spine | `trail` / `why` / `graph` from reconstruction |
| `verification` | Integrity panel | POST reconstruction or integrity with receipts |

`phase`: `ready` | `loading` | `error`. Loading never implies backend
progress percentages.

---

## 2. Allowed transitions

```text
welcome            --begin-->                 scenario_select
scenario_select    --select_scenario-->       scenario_select
scenario_select    --run_audit-->             running          (requires selectedScenario)
running            --audit_succeeded-->       result
running            --audit_failed-->          running (error)
result             --continue_to_simulate-->  simulate_ready
result             --open_trail-->            trail            (optional side path)
simulate_ready     --start_simulation-->      simulating
simulating         --simulation_succeeded-->  history
simulating         --simulation_failed-->     simulating (error)
history            --ask_why-->               investigation
history            --submit_search-->         search_results
investigation      --submit_search-->         search_results
search_results     --search_succeeded-->      search_results
search_results     --search_failed-->         search_results (error)
search_results     --open_result-->           reconstruction
reconstruction     --reconstruction_succeeded--> reconstruction
reconstruction     --open_trail-->            trail
trail              --open_verification-->     verification
verification       --verification_completed--> verification
verification       --open_trail-->            trail
verification       --ask_why-->               reconstruction
*                  --reset-->                 welcome
*                  --back-->                  previous (see table)
error              --retry-->                 same state, loading
```

`back` chain:

```text
verification → trail → reconstruction → search_results → investigation
  → history → simulate_ready → result → scenario_select → welcome
```

Anything else throws `IllegalTransitionError`. `canTransition` is the
non-throwing probe.

---

## 3. Golden path

```text
START → welcome → scenario_select → running → result
      → simulate_ready → simulating → history → investigation
      → search_results → reconstruction → trail → verification → END
```

`walkGoldenPath()` in `lib/demo` executes this with the financial hero
ids. Other scenarios may run at `run_audit`; they are secondary.

Target wall time (presentation, not backend): see
`DEMO_TIMING_SECONDS` in `lib/demo/copy.ts`. Do not throttle real APIs.

---

## 4. Two psychological phases

**Phase 1 — trust problem** (`welcome` … `history` / `investigation`):
the AI did important work; months later it is buried.

**Phase 2 — verifiable answer** (`search_results` … `verification`):
the exact execution is reconstructed and the record can be checked.

Do not flatten these into a feature dashboard.

---

## 5. Verification on the session

`verificationStatus` is `"verified" | "failed" | "unavailable" | "not-recorded" | null`.

After a successful run, the machine sets `unavailable` — receipts exist
in storage but have not been verified yet. GET reconstruction is also
`unavailable`. Only `verification_completed` from a real backend check
may set `verified` or `failed`.

The UI must not display “VERIFIED” when the status is `unavailable` or
`null`.

---

## 6. Reset

`{ type: "reset" }` returns `INITIAL_SESSION`. Pair with
`POST /api/simulation/reset`. Browser reload is not the primary reset.
