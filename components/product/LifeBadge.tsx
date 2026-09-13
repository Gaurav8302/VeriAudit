import { lifeLabel, type AuditLife } from "@/lib/product/lineage";

export function LifeBadge({ status }: { status: AuditLife }) {
  const tone =
    status === "sealed"
      ? "sealed"
      : status === "open"
        ? "open"
        : status === "reopened"
          ? "reopened"
          : status === "wip"
            ? "wip"
            : status === "recorded"
              ? "muted"
              : "sample";
  return <span className={`va-badge ${tone}`}>{lifeLabel(status)}</span>;
}
