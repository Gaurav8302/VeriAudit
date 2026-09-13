import { Fragment } from "react";

export interface LineageExecution {
  readonly number: string;
  readonly title: string;
  readonly date: string;
  readonly state: "sealed" | "new";
  readonly note: string;
  readonly basedOn?: string;
}

export function ExecutionLineage({
  auditTitle,
  executions,
}: {
  auditTitle: string;
  executions: readonly LineageExecution[];
}) {
  return (
    <section className="lineage" aria-label="Execution lineage">
      <p className="section-label">{auditTitle}</p>
      <ol className="lineage-track">
        {executions.map((execution, index) => (
          <Fragment key={execution.number}>
            {index > 0 && (
              <li className="lineage-link" aria-hidden="true">
                <span className="lineage-rule" />
                <span className="lineage-caption">
                  New work references #{executions[index - 1]!.number}. The
                  original remains unchanged.
                </span>
              </li>
            )}
            <li className="lineage-item">
              <p className="lineage-date">{execution.date}</p>
              <div className={`lineage-card ${execution.state}`}>
                <p className="exec-id">Execution #{execution.number}</p>
                <p className="exec-title">{execution.title}</p>
                <p className={`exec-state ${execution.state}`}>
                  {execution.state === "sealed" ? "Sealed" : "New"}
                </p>
                {execution.basedOn && (
                  <p className="exec-parent">
                    {`Execution #${execution.number} starts new work from the context of #${execution.basedOn}. It does not change what #${execution.basedOn} recorded.`}
                  </p>
                )}
                <p className="lineage-note">{execution.note}</p>
              </div>
            </li>
          </Fragment>
        ))}
      </ol>
    </section>
  );
}
