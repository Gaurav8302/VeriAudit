"use client";

import { useEffect, useState } from "react";
import { ExecutionLineage } from "@/components/experience/ExecutionLineage";
import { reconstruct, verifyCoolReceipt } from "@/lib/demo/client";
import { APPROVED_CLAIMS } from "@/lib/demo/copy";
import type { ExplainerTopic } from "@/lib/demo/explainer";
import { statusWord } from "@/lib/demo/format";
import type { IntegrityView, ReconstructionPayload, SessionEvidence } from "@/lib/demo/payloads";
import { firstReceipt, tamperLogState } from "@/lib/demo/tamper";
import type { VerificationStatus } from "@/lib/demo/types";

const ORIGINAL_EXECUTION = {
  number: "001",
  title: "Initial audit",
  date: "15 September 2026",
  state: "sealed" as const,
  note: "Historical record remains unchanged.",
};

const REWORK_EXECUTION = {
  number: "002",
  title: "Re-investigation of F-FIN-001",
  date: "15 December 2026",
  state: "new" as const,
  note: "Records the later investigation.",
  basedOn: "001",
};

type Beat =
  | "result"
  | "rework"
  | "rework-done"
  | "tamper"
  | "tampered"
  | "rechecking"
  | "failed"
  | "complete";

const MECHANISMS = [
  {
    term: "Digital signature",
    detail: "Provides cryptographic evidence that the receipt was produced by the expected signing identity.",
    tech: "ML-DSA-65 and Ed25519",
  },
  {
    term: "Inclusion proof",
    detail: "Shows that this recorded event belongs to the sealed execution.",
    tech: "Merkle / RFC 6962",
  },
  {
    term: "Measurement pinning",
    detail: "Checks that the execution is associated with the expected workload identity.",
    tech: "Pinned image measurement",
  },
  {
    term: "Trusted signing keys",
    detail: "Accepts only receipts signed by VeriAudit's published key identities.",
    tech: "Allow-listed key directory",
  },
  {
    term: "Append-only history",
    detail: "New work can be added, but changing previously sealed history becomes detectable.",
    tech: "Execution tree consistency",
  },
] as const;

const REWORK_STEPS = [
  "Additional evidence retrieved",
  "AI analysis performed",
  "Finding reassessed",
  "Human review recorded",
  "New conclusion recorded",
] as const;

export function Verification({
  reconstruction,
  evidence,
  loading,
  error,
  onRetry,
  onHome,
  onTopic,
  onPlace,
}: {
  reconstruction: ReconstructionPayload | null;
  evidence: SessionEvidence | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onHome: () => void;
  onTopic: (topic: ExplainerTopic) => void;
  onPlace: (place: string) => void;
}) {
  const [beat, setBeat] = useState<Beat>("result");
  const [howOpen, setHowOpen] = useState(false);
  const [tamperError, setTamperError] = useState<string | null>(null);
  const [failedIntegrity, setFailedIntegrity] = useState<IntegrityView | null>(null);
  const [identityRecognized, setIdentityRecognized] = useState<boolean | null>(null);

  useEffect(() => {
    onTopic(topicFor(beat));
    onPlace(placeFor(beat));
  }, [beat, onPlace, onTopic]);

  if (error) {
    return (
      <article className="frame">
        <p className="kicker">Verification</p>
        <h1 className="display">Verification did not complete.</h1>
        <p className="error" role="alert">
          {error}
        </p>
        <button type="button" className="primary" onClick={onRetry}>
          Try again
        </button>
      </article>
    );
  }

  if (loading || !reconstruction) {
    return (
      <article className="frame">
        <p className="kicker">Verification</p>
        <h1 className="display">Checking the recorded evidence.</h1>
        <p className="note">
          CooL, identity, and integrity are separate checks. None of them is
          assumed in advance.
        </p>
      </article>
    );
  }

  const integrity = reconstruction.integrity;
  const finding = reconstruction.findings?.[0];
  const review = reconstruction.reviews?.[0];
  const originalTitle =
    finding?.title ?? "Revenue recognised before performance obligation satisfied";
  const modifiedTitle = originalTitle.replace(/\bbefore\b/i, "after");
  const canTamper = Boolean(evidence && Object.keys(evidence.receipts).length > 0);
  const passed = integrity.status === "verified";

  if (beat === "rework") {
    return (
      <article className="frame">
        <p className="kicker">One more real-world situation</p>
        <h1 className="display">What if the team needs to investigate this finding again?</h1>
        <p className="lede">
          Real audits are not always one-and-done. A team may legitimately
          reopen an issue, ask the AI another question, or review new evidence.
        </p>
        <p className="lede lede-follow">
          The correct behaviour is not to rewrite the old execution. It is to
          create a new one that references it.
        </p>
        <ExecutionLineage
          auditTitle="Revenue Recognition Audit"
          executions={[ORIGINAL_EXECUTION]}
        />
        <button type="button" className="primary" onClick={() => setBeat("rework-done")}>
          Start new execution
        </button>
      </article>
    );
  }

  if (beat === "rework-done") {
    return (
      <article className="frame">
        <p className="kicker">Demonstration of versioned rework</p>
        <h1 className="display">The original execution was not rewritten.</h1>
        <p className="lede">
          Execution #002 records the later investigation and is linked back to
          Execution #001. This is not tampering. This is legitimate versioned
          work.
        </p>
        <ExecutionLineage
          auditTitle="Revenue Recognition Audit"
          executions={[ORIGINAL_EXECUTION, REWORK_EXECUTION]}
        />
        <p className="section-label">New work recorded</p>
        <ol className="plain faint rework-steps">
          {REWORK_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="note">
          This section demonstrates the product model. Execution #002 is not
          sealed by CooL in this build. Execution #001 remains the
          authoritative cryptographically verified execution.
        </p>
        <p className="thesis">
          Rework is allowed.
          <br />
          Rewriting history is detectable.
        </p>
        <button type="button" className="primary" onClick={() => setBeat("tamper")}>
          Now let&apos;s test the history
        </button>
      </article>
    );
  }

  if (beat === "tamper") {
    return (
      <article className="frame compose">
        <div>
          <p className="kicker">Integrity demonstration</p>
          <h1 className="display">Now let&apos;s test the history.</h1>
          <p className="lede">
            What happens if someone changes the historical record instead of
            creating a new execution?
          </p>
          <p className="lede lede-follow">
            We are not changing the company&apos;s financial data. We are changing
            the recorded history of what happened during the original
            AI-assisted audit.
          </p>
          <button
            type="button"
            className="primary"
            onClick={() => setBeat("tampered")}
          >
            Modify historical record
          </button>
        </div>
        <aside className="side-panel">
          <p className="section-label">Original sealed record</p>
          <p className="finding-id">
            {finding?.findingId ?? "F-FIN-001"}
            {review && (
              <>
                <span className="sep"> · </span>
                Human review: {review.decision}
              </>
            )}
          </p>
          <h2 className="side-title">{originalTitle}</h2>
          <p className="side-copy">
            This is what Execution #001 currently claims happened.
          </p>
        </aside>
      </article>
    );
  }

  if (beat === "tampered" || beat === "rechecking") {
    return (
      <article className="frame compose">
        <div>
          <p className="warn-label">Historical record modified</p>
          <h1 className="display">Why does this matter?</h1>
          <p className="lede">
            The underlying financial data did not change. What changed is what
            the historical execution now claims happened.
          </p>
          <p className="lede lede-follow">
            In a real system, this could happen through an administrator, a
            software bug, a compromised account, an accidental rewrite, or
            deliberate manipulation. The question months later is whether we can
            tell that the record no longer matches what was originally sealed.
          </p>
          {tamperError && (
            <p className="error" role="alert">
              {tamperError}
            </p>
          )}
          {!canTamper && (
            <p className="note">
              This session has no sealed receipts, so the integrity check cannot
              be run against CooL evidence.
            </p>
          )}
          <button
            type="button"
            className="primary"
            disabled={beat === "rechecking" || !canTamper}
            onClick={() =>
              void runTamperCheck({
                reconstruction,
                evidence,
                setBeat,
                setTamperError,
                setFailedIntegrity,
                setIdentityRecognized,
              })
            }
          >
            {beat === "rechecking" ? "Verifying…" : "Verify execution again"}
          </button>
        </div>
        <aside className="side-panel">
          <p className="section-label">Original</p>
          <p>{originalTitle}</p>
          <p className="section-label">Modified representation</p>
          <p>{modifiedTitle}</p>
          <p className="side-copy">
            Controlled integrity demonstration. Not a production database attack.
          </p>
        </aside>
      </article>
    );
  }

  if (beat === "failed" && failedIntegrity) {
    const cool = dimension(failedIntegrity.cool ?? failedIntegrity.status);
    const trail = dimension(failedIntegrity.status);
    const identity: Exclude<VerificationStatus, null> =
      identityRecognized === true
        ? "verified"
        : identityRecognized === false
          ? "failed"
          : dimension(failedIntegrity.identity ?? "unavailable");

    return (
      <article className="frame verify-frame">
        <header>
          <p className="kicker">CooL cryptographic verification</p>
          <h1 className="display">Execution verification failed.</h1>
          <p className="lede">
            The historical record no longer matches the evidence that was
            originally sealed.
          </p>
        </header>

        <div className="verify-grid">
          <Dimension
            name="Identity"
            status={identity}
            label={identity === "verified" ? "Recognized" : statusWord(identity)}
            copy={
              identity === "verified"
                ? "The signing identity is still the expected VeriAudit identity. This check used an original sealed receipt, not the modified representation."
                : copyFor("identity", identity)
            }
          />
          <Dimension
            name="Integrity"
            status={trail}
            label={trail === "failed" ? "Broken" : statusWord(trail)}
            copy={
              trail === "failed"
                ? "The current historical record no longer matches the sealed evidence."
                : copyFor("integrity", trail)
            }
          />
          <Dimension
            name="CooL"
            status={cool}
            label={cool === "failed" ? "Evidence mismatch" : statusWord(cool)}
            copy={
              cool === "failed"
                ? "CooL's cryptographic evidence no longer matches this historical representation."
                : copyFor("cool", cool)
            }
          />
        </div>

        {failedIntegrity.reasons && failedIntegrity.reasons.length > 0 && (
          <ul className="plain faint">
            {failedIntegrity.reasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}

        <p className="thesis">
          Rework is allowed.
          <br />
          Rewriting history is detectable.
        </p>
        <p className="lede">
          VeriAudit does not prevent legitimate changes. It preserves the
          distinction between new work and changed history.
        </p>
        <button type="button" className="primary" onClick={() => setBeat("complete")}>
          The demo is complete
        </button>
      </article>
    );
  }

  if (beat === "complete") {
    return (
      <article className="frame">
        <p className="kicker">End of demonstration</p>
        <h1 className="display">The demo is complete.</h1>
        <p className="lede">You&apos;ve seen the principle.</p>
        <p className="lede lede-follow">
          VeriAudit makes consequential AI work searchable, reconstructable, and
          cryptographically verifiable.
        </p>
        <p className="thesis">
          Rework is allowed.
          <br />
          Rewriting history is detectable.
        </p>
        <button type="button" className="primary" onClick={onHome}>
          Return to VeriAudit
        </button>
      </article>
    );
  }

  const cool = dimension(integrity.cool ?? integrity.status);
  const identity = dimension(integrity.identity ?? integrity.status);
  const trail = dimension(integrity.status);
  const sealed = integrity.verified ?? 0;

  return (
    <article className="frame verify-frame">
      <header>
        <p className="kicker">CooL cryptographic verification</p>
        <h1 className="display">
          {passed ? "Execution evidence verified." : "Execution evidence could not be verified."}
        </h1>
        <p className="lede">
          We are not verifying that the AI was correct. We are verifying that
          the recorded history of what happened is authentic and still matches
          the evidence that was originally sealed.
        </p>
        <p className="lede lede-follow">
          {passed
            ? "The execution's recorded evidence matches the cryptographic evidence that was originally sealed."
            : "CooL provides the cryptographic evidence used to perform this check."}
        </p>
      </header>

      <div className="verify-grid">
        <Dimension name="CooL" status={cool} copy={copyFor("cool", cool)} />
        <Dimension name="Identity" status={identity} copy={copyFor("identity", identity)} />
        <Dimension name="Integrity" status={trail} copy={copyFor("integrity", trail)} />
      </div>

      {passed && (
        <p className="cool-tally">
          {sealed > 0 ? `${sealed} / ${sealed} execution receipts verified` : "Execution receipts verified"}
          {integrity.rootsMatch ? " · Inclusion proofs passed" : ""}
        </p>
      )}

      {passed && (
        <p className="note">
          Nine canonical events were sealed with cryptographic evidence. CooL
          allows VeriAudit to independently check that evidence later.
        </p>
      )}

      {integrity.reason && <p className="note">{integrity.reason}</p>}
      {integrity.reasons && integrity.reasons.length > 0 && (
        <ul className="plain faint">
          {integrity.reasons.slice(0, 4).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      <p className="note">{APPROVED_CLAIMS.notACorrectnessProof}</p>
      <p className="note faint">Attestation in this environment is simulated.</p>

      <button type="button" className="ghost how-toggle" onClick={() => setHowOpen((value) => !value)}>
        {howOpen ? "Hide how this works" : "How does this work?"}
      </button>
      {howOpen && (
        <dl className="how">
          {MECHANISMS.map((item) => (
            <div key={item.term}>
              <dt>
                {item.term}
                <span className="how-tech"> · {item.tech}</span>
              </dt>
              <dd>{item.detail}</dd>
            </div>
          ))}
        </dl>
      )}

      {passed ? (
        <button type="button" className="primary" onClick={() => setBeat("rework")}>
          What if we need to investigate this again?
        </button>
      ) : (
        <button type="button" className="primary" onClick={onRetry}>
          Try again
        </button>
      )}
    </article>
  );
}

async function runTamperCheck({
  reconstruction,
  evidence,
  setBeat,
  setTamperError,
  setFailedIntegrity,
  setIdentityRecognized,
}: {
  reconstruction: ReconstructionPayload;
  evidence: SessionEvidence | null;
  setBeat: (beat: Beat) => void;
  setTamperError: (value: string | null) => void;
  setFailedIntegrity: (value: IntegrityView | null) => void;
  setIdentityRecognized: (value: boolean | null) => void;
}) {
  if (!evidence || Object.keys(evidence.receipts).length === 0) {
    setTamperError("No sealed receipts are held in this session.");
    return;
  }

  setBeat("rechecking");
  setTamperError(null);

  try {
    const original = firstReceipt(evidence.receipts);
    const identityPromise = original
      ? verifyCoolReceipt(original)
      : Promise.resolve(null);

    const record = await reconstruct(reconstruction.auditId, {
      receipts: evidence.receipts,
      logState: tamperLogState(evidence.logState),
      treeHead: evidence.treeHead ?? undefined,
    });

    const identity = await identityPromise;
    setFailedIntegrity(record.integrity);
    setIdentityRecognized(
      identity ? identity.signerTrusted && identity.measurementMatches : null,
    );

    if (record.integrity.status !== "failed") {
      setTamperError(
        record.integrity.status === "verified"
          ? "The integrity check still passed. The sealed evidence was not actually altered."
          : `Verification returned ${record.integrity.status}. The failure demonstration cannot continue from this result.`,
      );
      setBeat("tampered");
      return;
    }

    setBeat("failed");
  } catch (error) {
    setTamperError(error instanceof Error ? error.message : "Verification failed to run.");
    setBeat("tampered");
  }
}

function Dimension({
  name,
  status,
  copy,
  label,
}: {
  name: string;
  status: Exclude<VerificationStatus, null>;
  copy: string;
  label?: string;
}) {
  return (
    <div className={`verify-card ${status}`}>
      <p className="verify-name">{name}</p>
      <p className={`verify-status ${status}`}>{label ?? statusWord(status)}</p>
      <p>{copy}</p>
    </div>
  );
}

function dimension(value: string): Exclude<VerificationStatus, null> {
  if (value === "verified" || value === "failed" || value === "unavailable" || value === "not-recorded") {
    return value;
  }
  return "unavailable";
}

function copyFor(
  kind: "cool" | "identity" | "integrity",
  status: Exclude<VerificationStatus, null>,
): string {
  if (status === "verified") {
    if (kind === "cool") return APPROVED_CLAIMS.coolPassed;
    if (kind === "identity") return APPROVED_CLAIMS.identityVerified;
    return APPROVED_CLAIMS.integrityVerified;
  }
  if (status === "failed") return APPROVED_CLAIMS.failed;
  if (status === "not-recorded") return "No cryptographic evidence was created for this execution.";
  return APPROVED_CLAIMS.unavailable;
}

function topicFor(beat: Beat): ExplainerTopic {
  if (beat === "rework" || beat === "rework-done") return "rework";
  if (beat === "tamper" || beat === "tampered" || beat === "rechecking") return "tamper";
  if (beat === "failed") return "tamper-failed";
  if (beat === "complete") return "complete";
  return "verification";
}

function placeFor(beat: Beat): string {
  if (beat === "rework" || beat === "rework-done") return "Re-investigation";
  if (beat === "tamper" || beat === "tampered" || beat === "rechecking") return "Historical record";
  if (beat === "failed") return "Integrity failure";
  if (beat === "complete") return "Demonstration complete";
  return "Verification";
}

export function integrityStatus(integrity: IntegrityView): Exclude<VerificationStatus, null> {
  return dimension(integrity.status);
}
