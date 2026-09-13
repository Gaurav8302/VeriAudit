/**
 * The Vercel gate, as an executable.
 *
 *   npx tsx scripts/proof-http.ts http://localhost:3000
 *   npx tsx scripts/proof-http.ts https://<deployment>.vercel.app
 *
 * Runs the identical assertions against any base URL and prints a fingerprint.
 * Two runs against two hosts are comparable line by line, which is what turns
 * "Vercel probably behaves like local" into a confirmed fact.
 *
 * Exits non-zero on any failure.
 */
// Makes this file a module. Without it, TypeScript treats both proof scripts as
// global scripts and their top-level `base` / `json` / `post` collide.
export {};

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

const checks: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function json(path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const body = (await response.json()) as any;
  return { status: response.status, body };
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

function flipLastHex(value: string): string {
  return value.slice(0, -1) + (value.slice(-1) === "0" ? "1" : "0");
}

async function main() {
  console.log(`\nVeriAudit Milestone 1 — HTTP proof against ${base}\n`);

  // ── 1. identity ───────────────────────────────────────────────────────────
  console.log("1. identity");
  const identity = await json("/api/cool/identity");
  check("route responds 200", identity.status === 200, `status ${identity.status}`);
  check("runtime is nodejs", identity.body?.runtime?.name === "nodejs", identity.body?.runtime?.node);
  check("live plane matches the committed pin", identity.body?.pin?.matches === true);
  check("no configuration warnings", (identity.body?.warnings ?? []).length === 0);
  check("hardware attestation not claimed", identity.body?.hardware === false);
  const host = identity.body?.runtime?.vercel
    ? `vercel (${identity.body.runtime.region ?? "unknown region"})`
    : "local";
  console.log(`     host: ${host}, node ${identity.body?.runtime?.node}`);
  console.log(`     mrtd: ${String(identity.body?.measurement?.mrtd ?? "").slice(0, 40)}…`);
  console.log(`     record key: ${(identity.body?.trustedKeyIds ?? []).join(", ")}`);

  // ── 2. record ─────────────────────────────────────────────────────────────
  console.log("\n2. record 9 canonical events into one append-only tree");
  const recorded = await json("/api/cool/record", post({ useSample: true }));
  check("route responds 200", recorded.status === 200, `status ${recorded.status}`);
  const items = recorded.body?.recorded ?? [];
  check("nine receipts returned", items.length === 9, `got ${items.length}`);
  const leaves = items.map((r: any) => r.reference.leafIndex);
  check("leaf order preserved 0..8", JSON.stringify(leaves) === JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8]), JSON.stringify(leaves));
  check("tree size is 9", recorded.body?.treeHead?.treeSize === 9);
  check("post-quantum hybrid signature", items[0]?.reference?.signatureAlg === "ml-dsa-65+ed25519");
  check(
    "software digest explicitly null in the receipt",
    items[0]?.receipt?.record?.event?.software?.digest === null,
  );
  console.log(`     timings: ${JSON.stringify(recorded.body?.timings)}`);
  console.log(`     root:    ${recorded.body?.treeHead?.rootHash}`);

  const genuine = items[6]?.receipt;

  // ── 3. verify the genuine receipt ─────────────────────────────────────────
  console.log("\n3. verify the genuine receipt");
  const good = await json("/api/cool/verify", post({ receipt: genuine }));
  check("VERIFIED", good.body?.status === "verified" && good.body?.ok === true, good.body?.status);
  check("CooL verdict ok", good.body?.verdictOk === true);
  check("trusted signer", good.body?.signerTrusted === true);
  check("measurement matches pin", good.body?.measurementMatches === true);
  check("inclusion === pass", good.body?.logged === true);
  check("no AI-correctness claim", /does NOT mean the AI's conclusion was correct/.test(good.body?.claim ?? ""));

  // ── 4. tamper ─────────────────────────────────────────────────────────────
  console.log("\n4. tamper");
  const alteredReceipt = JSON.parse(JSON.stringify(genuine));
  alteredReceipt.binding_hash = flipLastHex(alteredReceipt.binding_hash);
  const altered = await json("/api/cool/verify", post({ receipt: alteredReceipt }));
  check("altered evidence → FAILED", altered.body?.ok === false, altered.body?.status);
  check("failure names the CooL check", (altered.body?.failures ?? []).some((f: any) => f.check === "cool"));

  const unloggedReceipt = JSON.parse(JSON.stringify(genuine));
  unloggedReceipt.inclusion = null;
  unloggedReceipt.sth = null;
  const unlogged = await json("/api/cool/verify", post({ receipt: unloggedReceipt }));
  check("missing inclusion → FAILED", unlogged.body?.ok === false, unlogged.body?.status);
  check(
    "…even though CooL itself accepts it",
    unlogged.body?.verdictOk === true && (unlogged.body?.coolReasons ?? []).length === 0,
    `verdictOk=${unlogged.body?.verdictOk}`,
  );

  const notAReceipt = await json("/api/cool/verify", post({ receipt: "nope" }));
  check("garbage input → FAILED, not a crash", notAReceipt.status === 200 && notAReceipt.body?.ok === false);

  // ── 5. full server-side matrix ────────────────────────────────────────────
  console.log("\n5. server-side self-test (13-case tamper matrix + append-only proofs)");
  const selftest = await json("/api/cool/selftest");
  check("route responds 200", selftest.status === 200, `status ${selftest.status}`);
  check("self-test passes", selftest.body?.pass === true);
  const s = selftest.body?.summary ?? {};
  check("all receipts verified", s.allReceiptsVerified === true);
  check("leaf ordering preserved across two stateless calls", s.leafOrderingPreserved === true);
  check("append-only proof holds for honest growth", s.appendOnlyProofHolds === true);
  check("deleting history is detected", s.deletionOfHistoryDetected === true);
  check("tamper matrix all pass", s.tamperMatrixAllPass === true);
  for (const row of selftest.body?.tamperMatrix ?? []) {
    console.log(`     ${row.pass ? "ok " : "BAD"} ${row.id.padEnd(4)} ${row.actual.padEnd(8)} ${row.name}`);
  }

  // ── fingerprint ───────────────────────────────────────────────────────────
  const failed = checks.filter((c) => !c.ok);

  // Split deliberately. The identity values MUST be byte-identical on every
  // host — that is the claim being proved. The root hash MUST NOT be, because
  // `randomSalt()` draws fresh bytes per record, so every run builds a
  // different tree over the same logical events (docs/COOL_SDK_AUDIT.md §7.2).
  const mustMatch = {
    coolVersion: s.coolVersion ?? null,
    mrtd: identity.body?.measurement?.mrtd ?? null,
    recordKeyId: (identity.body?.trustedKeyIds ?? [])[0] ?? null,
    pinMatches: identity.body?.pin?.matches ?? null,
    treeSize: recorded.body?.treeHead?.treeSize ?? null,
    leafOrder: leaves.join(","),
    verifiedGenuine: good.body?.ok === true,
    tamperMatrix: (selftest.body?.tamperMatrix ?? []).map((r: any) => `${r.id}:${r.actual}`).join(","),
  };

  const expectedToDiffer = {
    host,
    node: identity.body?.runtime?.node,
    region: identity.body?.runtime?.region ?? null,
    rootHash: recorded.body?.treeHead?.rootHash ?? null,
    receiptBytes: selftest.body?.recording?.receiptBytes ?? null,
    timings: recorded.body?.timings ?? null,
  };

  console.log("\n── MUST BE IDENTICAL local vs Vercel ──");
  console.log(JSON.stringify(mustMatch, null, 2));
  console.log("\n── expected to differ (host, and a fresh salt per record) ──");
  console.log(JSON.stringify(expectedToDiffer, null, 2));

  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length > 0) {
    console.log("\nFAILED:");
    for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
    process.exit(1);
  }
  console.log("ALL CHECKS PASSED\n");
}

main().catch((error) => {
  console.error(`\nproof harness crashed: ${(error as Error).message}`);
  process.exit(1);
});
