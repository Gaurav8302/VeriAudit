import { scenarioBriefing } from "@/lib/audit/scenarios/briefs";
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
          Four live audits. Each one runs on the same engine and produces a
          complete result. Financial is the recommended reference path.
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
          {scenarios.map((scenario) => {
            const briefing = scenario.briefing ?? scenarioBriefing(scenario.scenarioId);
            return (
              <button
                key={scenario.scenarioId}
                type="button"
                className={scenario.scenarioId === selected ? "scenario selected" : "scenario"}
                onClick={() => onSelect(scenario.scenarioId)}
                aria-pressed={scenario.scenarioId === selected}
              >
                <span>
                  <p className="scenario-domain">{briefing.domain}</p>
                  <p className="scenario-title">{scenario.title}</p>
                  <p className="scenario-one">{briefing.oneLine}</p>
                  <p className="scenario-meta">
                    {scenario.controlsInScope} controls
                    <span className="sep"> · </span>
                    {scenario.expected.exceptions} exceptions
                    <span className="sep"> · </span>
                    {scenario.period}
                  </p>
                </span>
                <span className={scenario.isHero ? "hero-tag" : "avail-tag"}>
                  {scenario.isHero ? "Recommended" : "Available"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="side-panel">
        {chosen ? (
          <ChosenBrief scenario={chosen} onRun={onRun} />
        ) : (
          <p className="side-empty">
            Select any engagement. All four are complete audits. Financial is
            marked recommended because it is the deepest reference story.
          </p>
        )}
      </aside>
    </article>
  );
}

function ChosenBrief({ scenario, onRun }: { scenario: ScenarioBrief; onRun: () => void }) {
  const briefing = scenario.briefing ?? scenarioBriefing(scenario.scenarioId);
  return (
    <>
      <p className="section-label">{scenario.isHero ? "Recommended" : "Ready to run"}</p>
      <h2 className="side-title">{scenario.title}</h2>
      <p className="side-copy">{briefing.what}</p>
      <p className="side-copy">{briefing.checking}</p>
      <p className="side-copy">{briefing.humanCares}</p>
      <dl className="meta-list">
        <div>
          <dt>Domain</dt>
          <dd>{briefing.domain}</dd>
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
        Run this audit
      </button>
    </>
  );
}
