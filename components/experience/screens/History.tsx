import { APPROVED_CLAIMS } from "@/lib/demo/copy";
import { formatMonth, formatShort, monthKey } from "@/lib/demo/format";
import type { Activity } from "@/lib/demo/payloads";

export function History({
  activities,
  onAsk,
}: {
  activities: readonly Activity[];
  onAsk: () => void;
}) {
  const groups = groupByMonth(activities);

  return (
    <article className="frame history-shell">
      <div className="history-feed">
        <p className="kicker">15 December 2026</p>
        <h1 className="display">The workspace did not stay still.</h1>
        <p className="lede">
          {activities.length} activities since September. The audit you ran is in
          this history. It is not at the top.
        </p>

        {groups.map((group) => (
          <section key={group.key}>
            <h2 className="month">{group.label}</h2>
            {group.rows.map((activity) => (
              <div key={activity.activityId} className="activity">
                <time dateTime={activity.occurredAt}>{formatShort(activity.occurredAt)}</time>
                <div>
                  <strong>{activity.title}</strong>
                  <span>
                    {activity.scenario}
                    <span className="sep"> · </span>
                    {activity.type.replace(/_/g, " ")}
                    <span className="sep"> · </span>
                    {activity.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      <div className="history-close">
        <div>
          <p className="section-label">A question from the CFO</p>
          <p className="dock-quote">{APPROVED_CLAIMS.bossQuery}?</p>
        </div>
        <button type="button" className="primary tight" onClick={onAsk}>
          Find the audit
        </button>
      </div>
    </article>
  );
}

function groupByMonth(activities: readonly Activity[]) {
  const groups: { key: string; label: string; rows: Activity[] }[] = [];
  for (const activity of activities) {
    const key = monthKey(activity.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.rows.push(activity);
    } else {
      groups.push({
        key,
        label: formatMonth(activity.occurredAt),
        rows: [activity],
      });
    }
  }
  return groups;
}
