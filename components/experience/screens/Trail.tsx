"use client";

import { useEffect, useMemo, useState } from "react";
import { money, stageLabel } from "@/lib/demo/format";
import type { ReconstructionPayload, TrailEventView, WhyStep } from "@/lib/demo/payloads";

export function Trail({
  reconstruction,
  onVerify,
  onSelectType,
}: {
  reconstruction: ReconstructionPayload;
  onVerify: () => void;
  onSelectType?: (type: string | null) => void;
}) {
  const path = useMemo(() => causalPath(reconstruction), [reconstruction]);
  const recorded = reconstruction.trail?.events?.length ?? 0;
  const spine = path.length;
  const [selectedId, setSelectedId] = useState(path[0]?.eventId ?? null);
  const selected = selectedId
    ? path.find((step) => step.eventId === selectedId) ?? path[0]
    : path[0];

  useEffect(() => {
    onSelectType?.(selected?.type ?? null);
  }, [onSelectType, selected?.type]);

  return (
    <article className="frame trail-frame">
      <header className="trail-head">
        <div>
          <p className="kicker">Execution trail</p>
          <h1 className="display">The recorded causal path.</h1>
          {recorded > 0 && (
            <p className="lede trail-count">
              {recorded} recorded events. The trail below shows the {spine}-stage
              causal spine so the execution can be understood at a glance.
            </p>
          )}
        </div>
        <button type="button" className="primary tight" onClick={onVerify}>
          Verify the recorded evidence
        </button>
      </header>

      <div className="trail-layout">
        <ol className="chain">
          {path.map((step, index) => (
            <li key={step.eventId}>
              {index > 0 && <span className="chain-line" aria-hidden="true" />}
              <button
                type="button"
                className={step.eventId === selected?.eventId ? "node active" : "node"}
                onClick={() => setSelectedId(step.eventId)}
              >
                <span className="node-dot" aria-hidden="true" />
                <span className="node-copy">
                  <span className="spine-type">{stageLabel(step.type)}</span>
                  <span className="node-title">{shortTitle(step)}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        {selected && (
          <EventDetail reconstruction={reconstruction} step={selected} />
        )}
      </div>
    </article>
  );
}

function EventDetail({
  reconstruction,
  step,
}: {
  reconstruction: ReconstructionPayload;
  step: WhyStep;
}) {
  const [inspect, setInspect] = useState(false);
  const event = findEvent(reconstruction, step.eventId);
  const finding = event?.findingRef
    ? reconstruction.findings?.find((item) => item.findingId === event.findingRef)
    : null;
  const review = event?.reviewRef
    ? reconstruction.reviews?.find((item) => item.reviewId === event.reviewRef)
    : null;
  const artifacts = (event?.artifactRefs ?? []).map((id) =>
    reconstruction.evidence?.find((item) => item.artifactId === id),
  );
  const parent = event?.parentEventId
    ? pathTitle(reconstruction, event.parentEventId)
    : null;
  const produced = childrenOf(reconstruction, step.eventId);

  return (
    <aside className="detail panel" aria-live="polite">
      <p className="spine-type">{stageLabel(step.type)}</p>
      <h3>{event?.title ?? step.title}</h3>

      <p className="detail-q">What happened?</p>
      <p>{explain(step, event)}</p>

      {artifacts.length > 0 && (
        <>
          <p className="detail-q">Evidence involved</p>
          <ul className="plain">
            {artifacts.map((artifact, index) => (
              <li key={artifact?.artifactId ?? index}>
                {artifact ? (
                  <>
                    <strong>{displayName(artifact.title)}</strong>
                    {artifact.parsed && (
                      <span className="hit-meta">{parsedHint(artifact.parsed)}</span>
                    )}
                  </>
                ) : (
                  event?.artifactRefs[index]
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {finding && (
        <>
          <p className="detail-q">Finding</p>
          <p>
            {finding.findingId} — {finding.title}
            {finding.amountUsd != null ? ` (${money(finding.amountUsd)})` : ""}
          </p>
        </>
      )}

      {review && (
        <>
          <p className="detail-q">Human review</p>
          <p>
            {review.decision} by {review.reviewer.name}.
          </p>
        </>
      )}

      {parent && (
        <>
          <p className="detail-q">Before this</p>
          <p>{parent}</p>
        </>
      )}

      {produced.length > 0 && (
        <>
          <p className="detail-q">This produced</p>
          <p>{produced.join(" → ")}</p>
        </>
      )}

      {(artifacts.some((item) => item?.content) || review?.note) && (
        <button type="button" className="ghost" onClick={() => setInspect((value) => !value)}>
          {inspect ? "Hide recorded detail" : "Inspect recorded detail"}
        </button>
      )}

      {inspect && (
        <div className="inspect">
          {artifacts.map((artifact) =>
            artifact?.content ? (
              <pre key={artifact.artifactId} className="excerpt">
                {excerpt(artifact.content)}
              </pre>
            ) : null,
          )}
          {review?.note && <p>{review.note}</p>}
        </div>
      )}
    </aside>
  );
}

function causalPath(reconstruction: ReconstructionPayload): WhyStep[] {
  const fromWhy = reconstruction.why?.path ?? reconstruction.trail?.why?.path ?? [];
  return [...fromWhy];
}

function findEvent(
  reconstruction: ReconstructionPayload,
  eventId: string,
): TrailEventView | undefined {
  return reconstruction.trail?.events?.find((event) => event.eventId === eventId);
}

function pathTitle(reconstruction: ReconstructionPayload, eventId: string): string {
  const fromPath = causalPath(reconstruction).find((step) => step.eventId === eventId);
  const event = findEvent(reconstruction, eventId);
  return event?.title ?? fromPath?.title ?? eventId;
}

function childrenOf(reconstruction: ReconstructionPayload, eventId: string): string[] {
  const edges = reconstruction.graph?.edges ?? [];
  return edges
    .filter((edge) => edge.from === eventId)
    .map((edge) => pathTitle(reconstruction, edge.to))
    .slice(0, 3);
}

function explain(step: WhyStep, event: TrailEventView | undefined): string {
  if (event?.summary) return event.summary;
  return `${stageLabel(step.type)} in the recorded chain.`;
}

function excerpt(content: string): string {
  return content.split("\n").slice(0, 6).join("\n");
}

function shortTitle(step: WhyStep): string {
  return step.title.replace(/^Evidence ingested:\s*/i, "").replace(/^Parsed:\s*/i, "");
}

function displayName(title: string): string {
  if (title.includes("C-1001")) return "Customer Contract C-1001";
  if (title.includes("C-1002")) return "Customer Contract C-1002";
  if (title.includes("REV-POL-3")) return "Policy REV-POL-3";
  if (title.toLowerCase().includes("ledger")) return "Q3 Revenue Ledger";
  return title;
}

function parsedHint(parsed: Readonly<Record<string, unknown>>): string {
  const bits: string[] = [];
  if (typeof parsed.total_usd === "number") {
    bits.push(money(parsed.total_usd) ?? "");
  }
  if (typeof parsed.contract_id === "string") bits.push(parsed.contract_id);
  if (typeof parsed.policy_id === "string") bits.push(parsed.policy_id);
  if (Array.isArray(parsed.undelivered_milestones) && parsed.undelivered_milestones.length > 0) {
    bits.push(`undelivered ${parsed.undelivered_milestones.join(", ")}`);
  }
  return bits.filter(Boolean).join(" · ");
}
