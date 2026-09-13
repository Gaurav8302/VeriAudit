/**
 * The AI seam.
 *
 * `Reasoner` is an interface so a hosted model could implement it later. The
 * shipped implementation is deterministic and local, for a reason the source of
 * truth §10 is explicit about: **LLM behaviour must not randomly change the
 * critical demo result.**
 *
 * The structure that makes both possible at once:
 *
 *   reasoning  → narrative + candidate observations   (could be a model)
 *        ↓
 *   controls   → pass/exception computed from evidence (always deterministic)
 *        ↓
 *   findings   → derived from control results only
 *
 * So a model can be swapped in to write better prose without being able to
 * change whether the audit passes. `model.executed` commits the reasoning that
 * actually ran, which is what makes "what did the AI do" answerable either way.
 *
 * `TODO` (P2): an `LlmReasoner` behind the same interface, with its output
 * validated against the control results before anything is recorded.
 */
import type { Reasoner, ReasonerInput, ReasonerOutput } from "./types";

/**
 * A reasoner whose narrative is authored per scenario.
 *
 * It reads the retrieved passages and parsed figures so its output is a
 * function of its input rather than a constant — the passages it cites are the
 * ones actually retrieved, so a change in retrieval changes the record.
 */
export function deterministicReasoner(spec: {
  name: string;
  version: string;
  assess: (input: ReasonerInput) => { assessment: string; observations: readonly string[] };
}): Reasoner {
  return {
    name: spec.name,
    version: spec.version,
    deterministic: true,
    analyse(input: ReasonerInput): ReasonerOutput {
      const { assessment, observations } = spec.assess(input);
      return {
        assessment,
        observations: [...observations],
        // Stated, not computed. A confidence score derived from nothing would
        // be theatre; this is the scenario author's judgement of the evidence.
        confidence: input.passages.length >= 5 ? "high" : "medium",
      };
    },
  };
}
