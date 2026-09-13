import type { Scenario } from "@/lib/audit/types";
import type { CatalogueResponse, ScenarioBrief } from "@/lib/demo/payloads";

export function ScenarioSelect({
  catalogue,
  selected,
  error,
  onSelect,
  onRun,
  onRetry,
}: {
  catalogue: CatalogueResponse | null;
  selected: Scenario | null;
  error: string | null;
  onSelect: (scenarioId: Scenario) => void;
  onRun: () => void;
  onRetry: () => void;
}) {
  const scenarios = catalogue?.scenarios ?? [];
  const chosen = scenarios.find((s) => s.scenarioId === selected) ?? null;

  return (
    <article className="frame compose">
      <div>
        <p className="kicker">Engagements</p>
        <h1 className="display">Choose an audit to run.</h1>
        <p className="lede">
          Four live scenarios. Financial is the recommended path through this
          demonstration.
        </p>

        {error && (
          <p className="error" role="alert">
            {error}{" "}
            <button type="button" className="text-btn" onClick={onRetry}>
              Try again
            </button>
          </p>
        )}

        {!catalogue && !error && <p className="note">Loading engagements…</p>}

        <div className="scenario-list">
          {scenarios.map((scenario) => (
            <button
              key={scenario.scenarioId}
              type="button"
              className={scenario.scenarioId === selected ? "scenario selected" : "scenario"}
              onClick={() => onSelect(scenario.scenarioId)}
              aria-pressed={scenario.scenarioId === selected}
            >
              <span>
                <p className="scenario-domain">{domainLabel(scenario.scenarioId)}</p>
                <p className="scenario-title">{scenario.displayName}</p>
                <p className="scenario-meta">
                  {scenario.title}
                  <span className="sep"> · </span>
                  {scenario.controlsInScope} controls
                </p>
              </span>
              {scenario.isHero && <span className="hero-tag">Recommended</span>}
            </button>
          ))}
        </div>
      </div>

      <aside className="side-panel">
        {chosen ? (
          <ChosenBrief scenario={chosen} onRun={onRun} />
        ) : (
          <p className="side-empty">Select an engagement. Financial is the one this story is built around.</p>
        )}
      </aside>
    </article>
  );
}

function ChosenBrief({ scenario, onRun }: { scenario: ScenarioBrief; onRun: () => void }) {
  return (
    <>
      <p className="section-label">{scenario.isHero ? "Recommended" : "Engagement"}</p>
      <h2 className="side-title">{scenario.title}</h2>
      <p className="side-copy">{scenario.description}</p>
      <dl className="meta-list">
        <div>
          <dt>Domain</dt>
          <dd>{domainLabel(scenario.scenarioId)}</dd>
        </div>
        <div>
          <dt>Controls</dt>
          <dd>{scenario.controlsInScope}</dd>
        </div>
        <div>
          <dt>Period</dt>
          <dd>{scenario.period}</dd>
        </div>
      </dl>
      <button type="button" className="primary" onClick={onRun}>
        Run {scenario.displayName.toLowerCase()}
      </button>
    </>
  );
}

function domainLabel(scenarioId: Scenario): string {
  if (scenarioId === "financial") return "Financial";
  if (scenarioId === "legal") return "Legal / compliance";
  if (scenarioId === "cyber") return "Cybersecurity";
  return "Procurement";
}
