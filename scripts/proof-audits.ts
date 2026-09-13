#!/usr/bin/env tsx
/**
 * HTTP proof for the Milestone 2 audit API.
 *
 * Exercises the routes a future frontend will call, in the order it will call
 * them, and prints a fingerprint that must match between local and Vercel —
 * the same technique `scripts/proof-http.ts` uses for the CooL routes.
 *
 *   tsx scripts/proof-audits.ts [baseUrl]
 */
// Makes this file a module. Without it, TypeScript treats both proof scripts as
// global scripts and their top-level `base` / `get` / `post` collide.
export {};

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? ` = ${JSON.stringify(actual)}` : `\n          expected ${JSON.stringify(expected)}\n          received ${JSON.stringify(actual)}`}`,
  );
}

async function get(path: string): Promise<any> {
  const response = await fetch(`${base}${path}`);
  if (!response.ok) throw new Error(`GET ${path} → ${response.status} ${await response.text()}`);
  return response.json();
}

async function post(path: string, body: unknown): Promise<any> {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`POST ${path} → ${response.status} ${await response.text()}`);
  return response.json();
}

async function main(): Promise<void> {
console.log(`\nVeriAudit audit API proof — ${base}\n`);

// ── 1. Catalogue ─────────────────────────────────────────────────────────────
console.log("1. GET /api/audits");
const catalogue = await get("/api/audits");
check("scenarios", catalogue.scenarios.length, 4);
check("heroScenarioId", catalogue.heroScenarioId, "financial");
check(
  "scenario ids",
  catalogue.scenarios.map((s: any) => s.scenarioId),
  ["financial", "legal", "cyber", "procurement"],
);

// ── 2. Run every scenario ────────────────────────────────────────────────────
console.log("\n2. POST /api/audits/run (all four scenarios)");
const runs: Record<string, any> = {};
for (const scenario of catalogue.scenarios) {
  const run = await post("/api/audits/run", { scenario: scenario.scenarioId });
  runs[scenario.scenarioId] = run;
  check(
    `${scenario.scenarioId} result`,
    [
      run.audit.summary.controlsTested,
      run.audit.summary.controlsPassed,
      run.audit.summary.exceptions,
      run.trail.counts.events,
      run.sealing.sealed,
    ],
    [
      scenario.expected.controlsTested,
      scenario.expected.controlsPassed,
      scenario.expected.exceptions,
      run.trail.counts.events,
      9,
    ],
  );
}

const hero = runs["financial"];
console.log("\n3. Financial hero specifics");
check("controls / passed / exceptions", [
  hero.audit.summary.controlsTested,
  hero.audit.summary.controlsPassed,
  hero.audit.summary.exceptions,
], [12, 9, 3]);
check("events", hero.trail.counts.events, 30);
check("canonical", hero.trail.counts.canonical, 9);
check("sealed", hero.trail.counts.sealed, 9);
check("receipts returned", Object.keys(hero.receipts).length, 9);
check("logState length", hero.logState.length, 9);
check("treeSize", hero.sealing.treeHead.treeSize, 9);
check("spine length", hero.trail.spineEventIds.length, 9);
check("hero finding", hero.audit.findings[0].findingId, "F-FIN-001");
check("hero control", hero.audit.findings[0].controlId, "REV-REC-01");
check("human review completed", hero.audit.summary.humanReviewCompleted, true);
check(
  "review decisions",
  hero.audit.reviews.map((r: any) => r.decision),
  ["accepted", "accepted", "modified"],
);

// ── 4. Verify the receipts the run returned ──────────────────────────────────
console.log("\n4. POST /api/audits/AUD-FIN-2026-09/verification");
const verification = await post("/api/audits/AUD-FIN-2026-09/verification", {
  receipts: hero.receipts,
});
check("status", verification.status, "verified");
check("counts", verification.counts, { checked: 9, verified: 9, failed: 0 });
check(
  "every domain inclusion passes",
  verification.results.every((r: any) => r.state.domains.inclusion.status === "pass"),
  true,
);

// ── 5. Regenerated retrieval, no database ────────────────────────────────────
console.log("\n5. GET /api/audits/AUD-FIN-2026-09");
const regenerated = await get("/api/audits/AUD-FIN-2026-09");
check(
  "summary matches the run",
  regenerated.audit.summary,
  hero.audit.summary,
);
check("evidence artifacts", regenerated.evidence.length, 4);
check(
  "ledger plaintext present",
  regenerated.evidence[0].content.includes("E-1001"),
  true,
);
check("cool references are honestly null", regenerated.trail.events.every((e: any) => e.cool === null), true);

console.log("\n6. GET /api/audits/AUD-FIN-2026-09/events");
const trail = await get("/api/audits/AUD-FIN-2026-09/events");
check("events", trail.events.length, 30);
check("edges", trail.edges.length, 29);
check("root", trail.rootEventId, "EVT-FIN-2609-001");
check(
  "spine types",
  trail.spineEventIds.map((id: string) => trail.events.find((e: any) => e.eventId === id).type),
  [
    "audit.started",
    "artifact.ingested",
    "artifact.parsed",
    "retrieval.executed",
    "model.executed",
    "control.tested",
    "finding.created",
    "human.review.completed",
    "conclusion.created",
  ],
);

const findingEventId = trail.events.find((e: any) => e.findingRef === "F-FIN-001").eventId;
const detail = await get(`/api/audits/AUD-FIN-2026-09/events?eventId=${findingEventId}`);
check("ancestors of the hero finding", detail.ancestors.length, 7);
check("children of the hero finding", detail.children.length, 1);

console.log("\n7. GET /api/audits/AUD-FIN-2026-09/findings");
const findings = await get("/api/audits/AUD-FIN-2026-09/findings");
check("findings", findings.findings.length, 3);
check("each names its control", findings.findings.every((f: any) => f.control !== null), true);
check(
  "each cites resolved evidence",
  findings.findings.every((f: any) => f.evidence.length > 0 && f.evidence.every((e: any) => e.title !== null)),
  true,
);
check("hero evidence count", findings.findings[0].evidence.length, 3);

console.log("\n8. Reviews");
const reviewState = await get("/api/audits/AUD-CYB-2026-09/reviews");
check("cyber has one finding awaiting a person", reviewState.awaitingReview.length, 1);
check("cyber human review incomplete", reviewState.humanReviewCompleted, false);

const live = await post("/api/audits/AUD-FIN-2026-09/reviews", {
  findingId: "F-FIN-003",
  decision: "rejected",
  note: "Re-reviewed: the compensating month-end control is documented, so this is not an exception.",
  reviewer: { name: "A. Demir", role: "Audit Partner" },
  sequence: 30,
  logState: hero.logState,
});
check("live review sealed", live.sealing.sealed, true);
check("live event id", live.event.eventId, "EVT-FIN-2609-031");
check("finding status after review", live.finding.status, "rejected");
check("appended to the same tree", live.logState.length, 10);
check("leaf index", live.event.cool.leafIndex, 9);

const liveVerification = await post("/api/audits/AUD-FIN-2026-09/verification", {
  receipts: { [live.receipt.receiptRef]: live.receipt.evidence },
});
check("live review receipt verifies", liveVerification.status, "verified");

console.log("\n9. Rejections");
for (const [label, path, body, expected] of [
  ["unknown audit", "/api/audits/AUD-NOPE/findings", null, 404],
  ["unknown scenario", "/api/audits/run", { scenario: "nope" }, 404],
  ["missing scenario", "/api/audits/run", {}, 400],
  [
    "review without a note",
    "/api/audits/AUD-FIN-2026-09/reviews",
    { findingId: "F-FIN-001", decision: "accepted", note: "" },
    400,
  ],
  [
    "unknown finding",
    "/api/audits/AUD-FIN-2026-09/reviews",
    { findingId: "F-FIN-999", decision: "accepted", note: "n/a" },
    404,
  ],
] as const) {
  const response = await fetch(`${base}${path}`, {
    method: body === null ? "GET" : "POST",
    ...(body === null
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  check(label, response.status, expected);
}

console.log("\n10. Milestone 3 trail routes");
const execution = await get("/api/audits/AUD-FIN-2026-09/execution");
check("execution eventCount", execution.eventCount, 30);
check("execution why length", execution.why.path.length, 9);
check("execution why types", execution.why.path.map((s: any) => s.type), [
  "audit.started",
  "artifact.ingested",
  "artifact.parsed",
  "retrieval.executed",
  "model.executed",
  "control.tested",
  "finding.created",
  "human.review.completed",
  "conclusion.created",
]);

const oneEvent = await get("/api/audits/AUD-FIN-2026-09/events/EVT-FIN-2609-001");
check("event-by-id type", oneEvent.event.type, "audit.started");
check("event-by-id ancestors", oneEvent.ancestors, ["EVT-FIN-2609-001"]);

const controlsOnly = await get("/api/audits/AUD-FIN-2026-09/events?type=control.tested");
check("type filter count", controlsOnly.events.length, 12);
check("type filter all control.tested", controlsOnly.events.every((e: any) => e.type === "control.tested"), true);

const integrityGet = await get("/api/audits/AUD-FIN-2026-09/integrity");
check("GET integrity is honest about missing receipts", integrityGet.verificationStatus, "not-recorded");

const integrityPost = await post("/api/audits/AUD-FIN-2026-09/integrity", {
  receipts: hero.receipts,
  logState: hero.logState,
  treeHead: hero.sealing.treeHead,
});
check("POST integrity status", integrityPost.status, "verified");
check("POST integrity verified count", integrityPost.verified, 9);
check("POST integrity roots match", integrityPost.tree.rootsMatch, true);

console.log("\n11. Milestone 4 simulation");
const started = await post("/api/simulation/start", {});
check("start activityCount", started.activityCount, 55);
check("start hero audit", started.heroAuditId, "AUD-FIN-2026-09");
check("start hero execution", started.heroExecutionId, "EXEC-FIN-2026-09-001");
check("start seed", started.seed, 20260915);

const again = await post("/api/simulation/start", {});
check("repeat start does not grow", again.activityCount, 55);
check(
  "repeat start same ids",
  again.activities.map((a: any) => a.activityId),
  started.activities.map((a: any) => a.activityId),
);

const reset = await post("/api/simulation/reset", {});
check("reset activityCount", reset.activityCount, 55);
check("reset flag", reset.reset, true);

const corpus = await get("/api/simulation");
check("GET activities", corpus.activities.length, 55);
check("GET audits", corpus.audits.length, 14);
check("GET hero unique", corpus.audits.filter((a: any) => a.isHero).length, 1);

console.log("\n12. Milestone 5 search + reconstruction");
const heroSearch = await get("/api/search?q=revenue%20recognition%20exception");
check("hero query top audit", heroSearch.groups[0].auditId, "AUD-FIN-2026-09");
check("hero query top execution", heroSearch.groups[0].executionId, "EXEC-FIN-2026-09-001");

const bossSearch = await get("/api/search?q=why%20did%20we%20flag%20this%20revenue%20transaction");
check("boss query top audit", bossSearch.groups[0].auditId, "AUD-FIN-2026-09");

const financialOnly = await get("/api/search?q=revenue&domain=financial");
check("domain filter", financialOnly.results.every((r: any) => r.domain === "financial"), true);

const empty = await get("/api/search?q=");
check("empty query is the feed", empty.results.length, 55);

const reconstructed = await get("/api/audits/AUD-FIN-2026-09/reconstruction");
check("reconstruction execution", reconstructed.executionId, "EXEC-FIN-2026-09-001");
check("reconstruction why length", reconstructed.why.path.length, 9);
check("GET reconstruction is not a fake pass", reconstructed.integrity.status, "unavailable");

const verified = await post("/api/audits/AUD-FIN-2026-09/reconstruction", {
  receipts: hero.receipts,
  logState: hero.logState,
  treeHead: hero.sealing.treeHead,
});
check("POST reconstruction verified", verified.integrity.status, "verified");

// ── Fingerprint ──────────────────────────────────────────────────────────────
// Everything here is deterministic, so it must be byte-identical between a
// local run and a Vercel run. Receipt ids and timings are excluded because a
// fresh salt per record makes them intentionally unstable.
const fingerprint = {
  scenarios: catalogue.scenarios.map((s: any) => [
    s.scenarioId,
    s.expected.controlsTested,
    s.expected.controlsPassed,
    s.expected.exceptions,
  ]),
  results: Object.entries(runs).map(([id, run]: [string, any]) => [
    id,
    run.audit.summary.controlsTested,
    run.audit.summary.controlsPassed,
    run.audit.summary.exceptions,
    run.trail.counts.events,
    run.trail.counts.canonical,
    run.sealing.sealed,
  ]),
  heroEventIds: hero.trail.events.map((e: any) => e.eventId),
  heroSpine: hero.trail.spineEventIds,
  heroFindings: hero.audit.findings.map((f: any) => [f.findingId, f.controlId, f.severity, f.status]),
  heroConclusion: hero.audit.conclusion.statement,
};

console.log("\n─────────────────────────────────────────────");
console.log("FINGERPRINT (must match local ↔ deployed)");
console.log(JSON.stringify(fingerprint));
console.log("─────────────────────────────────────────────");
console.log(failures === 0 ? "\nALL CHECKS PASSED\n" : `\n${failures} CHECK(S) FAILED\n`);
}

main()
  .then(() => process.exit(failures === 0 ? 0 : 1))
  .catch((error) => {
    console.error(`\nPROOF ABORTED: ${(error as Error).message}\n`);
    process.exit(1);
  });
