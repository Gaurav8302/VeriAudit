import { lifeLabel, type AuditLife } from "@/lib/product/lineage";
import { phaseLabel, type WorkspacePhase } from "@/lib/product/workspacePhase";

export function LifeBadge({ status }: { status: AuditLife }) {
  const tone =
    status === "sealed"
      ? "sealed"
      : status === "open"
        ? "open"
        : status === "closed"
          ? "closed"
          : status === "review_required"
            ? "review"
            : status === "reopened"
              ? "reopened"
              : status === "wip"
                ? "wip"
                : status === "recorded"
                  ? "muted"
                  : "sample";
  return <span className={`va-badge ${tone}`}>{lifeLabel(status)}</span>;
}

export function PhaseBadge({ phase }: { phase: WorkspacePhase }) {
  const tone =
    phase === "sealed" || phase === "ready_to_seal"
      ? "sealed"
      : phase === "review"
        ? "review"
        : phase === "active" || phase === "reopened"
          ? "open"
          : phase === "recorded"
            ? "muted"
            : "demo";
  return <span className={`va-badge ${tone}`}>{phaseLabel(phase)}</span>;
}

export function DemoMark() {
  return <span className="va-demo">Demo data</span>;
}
