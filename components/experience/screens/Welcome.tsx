import { APPROVED_CLAIMS } from "@/lib/demo/copy";

export function Welcome({ onBegin }: { onBegin: () => void }) {
  return (
    <article className="frame compose">
      <div>
        <p className="kicker">Guided demonstration</p>
        <h1 className="display">One audit. Then time. Then the question.</h1>
        <p className="lede">{APPROVED_CLAIMS.welcome}</p>
        <p className="lede lede-follow">
          You will run one of four live audits, let three months of work bury
          it, and recover the original execution when someone asks why.
          Financial is the recommended reference path. The others are complete
          audits, not placeholders.
        </p>
        <button type="button" className="primary" onClick={onBegin}>
          Begin an audit
        </button>
      </div>
      <aside className="side-panel">
        <p className="section-label">What this walkthrough holds</p>
        <ol className="beat-list">
          <li>
            <strong>Run</strong>
            <span>A live engagement with a computed result.</span>
          </li>
          <li>
            <strong>Time</strong>
            <span>The record becomes one item among many.</span>
          </li>
          <li>
            <strong>Recover</strong>
            <span>Search finds the original execution.</span>
          </li>
          <li>
            <strong>Verify</strong>
            <span>The trail and its evidence can be checked.</span>
          </li>
        </ol>
      </aside>
    </article>
  );
}
