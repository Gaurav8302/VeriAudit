/**
 * Pure historical generator.
 *
 *   generateHistory(seed) → { audits, executions, activities }
 *
 * No I/O, no wall clock, no CooL, no AuditEngine. The hero audit is
 * referenced from the existing scenario constants; its 12/9/3 result and
 * its 30 event ids are copied, never recomputed here.
 *
 * Re-running with the same seed returns a deeply equal corpus. There is
 * nothing to append and therefore nothing to duplicate.
 */
import { eventId } from "@/lib/audit/ids";
import {
  cyberScenario,
  financialScenario,
  legalScenario,
  procurementScenario,
} from "@/lib/audit/scenarios";
import { dayAt, daysBetween, toIso, utcMs, weekdayInWindow } from "./calendar";
import { ACTIVITY_DRAFTS, ACTIVITY_TYPES, AUDITS } from "./catalog";
import {
  DEMO_TODAY,
  HERO_AUDIT_ID,
  HERO_EXECUTION_ID,
  HERO_OPENED_AT,
  SEED,
  rng,
  type Rng,
} from "./rng";
import type {
  Activity,
  ActivityType,
  SimulatedExecution,
  SimulationResult,
  SimulationStats,
  SimulationSummary,
} from "./types";

const WINDOWS: readonly { minDay: number; maxDay: number; count: number }[] = [
  { minDay: 0, maxDay: 14, count: 16 },
  { minDay: 15, maxDay: 35, count: 14 },
  { minDay: 36, maxDay: 60, count: 13 },
  { minDay: 61, maxDay: 85, count: 9 },
  { minDay: 86, maxDay: 92, count: 3 },
];

const ENGINE = { name: "veriaudit-reasoner", version: "0.1.0" } as const;

function engineEventCount(scenario: {
  artifacts: readonly unknown[];
  controls: readonly unknown[];
  expected: { findings: number };
  reviewPolicy: { decisions: Readonly<Record<string, unknown>> };
}): number {
  const reviews = Object.keys(scenario.reviewPolicy.decisions).length;
  return (
    1 +
    scenario.artifacts.length * 2 +
    2 +
    scenario.controls.length +
    scenario.expected.findings +
    reviews +
    1
  );
}

function heroEventIds(): string[] {
  return Array.from({ length: engineEventCount(financialScenario) }, (_, i) =>
    eventId(financialScenario, i),
  );
}

function realEventIds(
  scenario: { eventCode: string } & Parameters<typeof engineEventCount>[0],
): string[] {
  return Array.from({ length: engineEventCount(scenario) }, (_, i) => eventId(scenario, i));
}

function executions(): SimulatedExecution[] {
  return AUDITS.map((audit) => {
    const isHero = audit.auditId === HERO_AUDIT_ID;
    const isLegal = audit.auditId === legalScenario.auditId;
    const isCyber = audit.auditId === cyberScenario.auditId;
    const isProc = audit.auditId === procurementScenario.auditId;

    let eventIds: string[] = [];
    let rootEventId: string | null = null;
    if (isHero) {
      eventIds = heroEventIds();
      rootEventId = eventIds[0] ?? null;
    } else if (isLegal) {
      eventIds = realEventIds(legalScenario);
      rootEventId = eventIds[0] ?? null;
    } else if (isCyber) {
      eventIds = realEventIds(cyberScenario);
      rootEventId = eventIds[0] ?? null;
    } else if (isProc) {
      eventIds = realEventIds(procurementScenario);
      rootEventId = eventIds[0] ?? null;
    }

    return {
      executionId: audit.executionIds[0] ?? `${audit.auditId}-EXEC`,
      auditId: audit.auditId,
      startedAt: audit.openedAt,
      completedAt: audit.closedAt,
      engine: ENGINE,
      eventIds,
      rootEventId,
      coolBacked: isHero,
      logHead: null,
    };
  });
}

function shuffle<T>(items: readonly T[], rand: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const current = out[i]!;
    out[i] = out[j]!;
    out[j] = current;
  }
  return out;
}

function pickTimestamp(rand: Rng, minDay: number, maxDay: number, used: Set<string>): string {
  for (let attempt = 0; attempt < 80; attempt++) {
    const raw = minDay + Math.floor(rand() * (maxDay - minDay + 1));
    const day = weekdayInWindow(raw, minDay, maxDay);
    if (day === null) continue;

    const maxHour = day === 0 ? 8 : 18;
    const hour = 8 + Math.floor(rand() * (maxHour - 8 + 1));
    const minute = Math.floor(rand() * 60);
    const second = Math.floor(rand() * 48);
    const at = dayAt(day);
    const ms = Date.UTC(
      at.getUTCFullYear(),
      at.getUTCMonth(),
      at.getUTCDate(),
      hour,
      minute,
      second,
    );

    if (ms > utcMs(DEMO_TODAY)) continue;
    const iso = toIso(ms);
    if (used.has(iso)) continue;
    used.add(iso);
    return iso;
  }
  throw new Error(`could not place a unique weekday timestamp in days ${minDay}–${maxDay}`);
}

function dateActivities(rand: Rng): Activity[] {
  const used = new Set<string>();
  const pinned = ACTIVITY_DRAFTS.filter((d) => d.pinnedAt !== undefined);
  const unpinned = ACTIVITY_DRAFTS.filter((d) => d.pinnedAt === undefined);

  for (const draft of pinned) {
    used.add(draft.pinnedAt!);
  }

  const shuffled = shuffle(unpinned, rand);

  const remainingSlots = WINDOWS.map((w) => ({
    ...w,
    remaining: w.count - pinned.filter((d) => {
      const back = daysBetween(d.pinnedAt!, DEMO_TODAY);
      return back >= w.minDay && back <= w.maxDay;
    }).length,
  }));

  if (remainingSlots.reduce((n, w) => n + w.remaining, 0) !== unpinned.length) {
    throw new Error(
      `window leftover ${remainingSlots.reduce((n, w) => n + w.remaining, 0)} ≠ unpinned ${unpinned.length}`,
    );
  }

  const dated: { draft: (typeof ACTIVITY_DRAFTS)[number]; occurredAt: string }[] = pinned.map(
    (draft) => ({ draft, occurredAt: draft.pinnedAt! }),
  );

  let cursor = 0;
  for (const window of remainingSlots) {
    for (let i = 0; i < window.remaining; i++) {
      const draft = shuffled[cursor];
      if (!draft) throw new Error("ran out of unpinned drafts");
      dated.push({
        draft,
        occurredAt: pickTimestamp(rand, window.minDay, window.maxDay, used),
      });
      cursor += 1;
    }
  }

  dated.sort((a, b) => {
    const byTime = b.occurredAt.localeCompare(a.occurredAt);
    return byTime !== 0 ? byTime : a.draft.title.localeCompare(b.draft.title);
  });

  return dated.map((row, index) => ({
    activityId: `ACT-${String(index + 1).padStart(4, "0")}`,
    occurredAt: row.occurredAt,
    type: row.draft.type,
    scenario: row.draft.scenario,
    title: row.draft.title,
    description: row.draft.description,
    auditId: row.draft.auditId,
    executionId: row.draft.executionId,
    status: row.draft.status,
    findingId: row.draft.findingId,
    actor: row.draft.actor,
    searchTags: row.draft.searchTags,
    coolBacked: row.draft.coolBacked,
  }));
}

function statsOf(activities: readonly Activity[]): SimulationStats {
  const heroTime = utcMs(HERO_OPENED_AT);
  const times = activities.map((a) => utcMs(a.occurredAt));
  const oldest = Math.min(...times);
  const newest = Math.max(...times);

  const byType = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t, 0])) as Record<ActivityType, number>;
  const byScenario = { financial: 0, legal: 0, cyber: 0, procurement: 0 };

  for (const activity of activities) {
    byType[activity.type] += 1;
    byScenario[activity.scenario] += 1;
  }

  return {
    totalActivities: activities.length,
    totalAudits: AUDITS.length,
    spanDays: Math.round((newest - oldest) / 86_400_000),
    activitiesNewerThanHero: activities.filter((a) => utcMs(a.occurredAt) > heroTime).length,
    scenariosCovered: (Object.values(byScenario) as number[]).filter((n) => n > 0).length,
    byType,
    byScenario,
  };
}

export function generateHistory(seed: number = SEED): SimulationResult {
  const activities = dateActivities(rng(seed));
  const stats = statsOf(activities);
  const times = activities.map((a) => a.occurredAt).sort();

  return {
    simulationId: `SIM-${seed}`,
    generatedAt: DEMO_TODAY,
    seed,
    demoToday: DEMO_TODAY,
    startDate: times[0] ?? HERO_OPENED_AT,
    endDate: times[times.length - 1] ?? DEMO_TODAY,
    heroAuditId: HERO_AUDIT_ID,
    heroExecutionId: HERO_EXECUTION_ID,
    audits: AUDITS,
    executions: executions(),
    activities,
    stats,
  };
}

export function simulationSummary(result: SimulationResult): SimulationSummary {
  return {
    simulationId: result.simulationId,
    seed: result.seed,
    startDate: result.startDate,
    endDate: result.endDate,
    activityCount: result.stats.totalActivities,
    auditCount: result.stats.totalAudits,
    heroAuditId: result.heroAuditId,
    heroExecutionId: result.heroExecutionId,
    stats: result.stats,
  };
}

/** Same corpus every call. Exists so "start" and "reset" share one implementation. */
export function loadDemoState(seed: number = SEED): SimulationResult {
  return generateHistory(seed);
}
