/**
 * GET /api/cool/selftest — the whole Milestone 1 proof, in one request.
 *
 * Records the nine canonical events into one append-only tree, verifies each
 * receipt, then runs the tamper matrix from `lib/proof/tamper.ts` — the SAME
 * matrix the unit tests run. That is what makes the Vercel gate meaningful:
 * the deployed result is comparable to the local result assertion by assertion,
 * not just "the endpoint returned 200".
 *
 * Proof-only endpoint. It does not survive into the shipped product.
 */
import { NextResponse } from "next/server";
import { proveAppendOnly, recordEvents, sealedKeys, verifyReceipts } from "@/lib/cool";
import { sampleTrail } from "@/lib/proof/sample-trail";
import { runTamperMatrix } from "@/lib/proof/tamper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const startedAt = Date.now();

  try {
    const events = sampleTrail();

    // 1. Record the trail into one tree, in causal order.
    const first = await recordEvents(events.slice(0, 6), []);
    // 2. Continue the SAME tree in a second call, as a stateless fleet would.
    const second = await recordEvents(events.slice(6), first.logState);

    const recorded = [...first.recorded, ...second.recorded];
    const logState = second.logState;

    // 3. Verify every receipt under the production policy.
    const states = await verifyReceipts(recorded.map((r) => r.receipt));

    // 4. Prove the second call only appended to the first call's tree.
    const keys = await sealedKeys();
    const appendOnly =
      first.treeHead === null
        ? { ok: false, reason: "no tree head from the first batch", currentTreeSize: 0, currentRootHash: "" }
        : proveAppendOnly(
            keys.log,
            { treeSize: first.treeHead.treeSize, rootHash: first.treeHead.rootHash },
            logState,
          );

    // 5. Prove that removing a historical event breaks the chain.
    const deletionDetected =
      first.treeHead === null
        ? null
        : proveAppendOnly(
            keys.log,
            { treeSize: first.treeHead.treeSize, rootHash: first.treeHead.rootHash },
            [...logState.slice(0, 2), ...logState.slice(3)],
          );

    // 6. The tamper matrix, against a genuine receipt.
    const genuine = recorded[6]?.receipt ?? recorded[0]?.receipt;
    const matrix = await runTamperMatrix(genuine);

    const leafOrder = recorded.map((r) => r.reference.leafIndex);
    const orderingOk = leafOrder.every((leaf, index) => leaf === index);
    const allVerified = states.every((s) => s.ok);

    const pass =
      allVerified &&
      orderingOk &&
      appendOnly.ok &&
      deletionDetected?.ok === false &&
      matrix.allPass;

    return NextResponse.json({
      pass,
      summary: {
        coolVersion: "3.0.0",
        eventsRecorded: recorded.length,
        allReceiptsVerified: allVerified,
        leafOrderingPreserved: orderingOk,
        treeSize: second.treeHead?.treeSize ?? null,
        appendOnlyProofHolds: appendOnly.ok,
        deletionOfHistoryDetected: deletionDetected?.ok === false,
        tamperMatrixAllPass: matrix.allPass,
        elapsedMs: Date.now() - startedAt,
      },
      recording: {
        leafOrder,
        treeHead: second.treeHead,
        timings: { first: first.timings, second: second.timings },
        receiptBytes: JSON.stringify(recorded[0]?.receipt ?? {}).length,
      },
      verification: states.map((s, i) => ({
        eventId: recorded[i]?.eventId ?? null,
        eventType: s.subject.eventType,
        status: s.status,
        verdictOk: s.verdictOk,
        signerTrusted: s.signerTrusted,
        measurementMatches: s.measurementMatches,
        logged: s.logged,
        hardware: s.hardware,
        leafIndex: s.subject.leafIndex,
        treeSize: s.subject.treeSize,
        domains: s.domains,
      })),
      appendOnly: {
        honestGrowth: appendOnly,
        afterDeletingEvent3: deletionDetected,
      },
      tamperMatrix: matrix.results,
      runtime: {
        name: "nodejs",
        node: process.version,
        vercel: process.env["VERCEL"] === "1",
        region: process.env["VERCEL_REGION"] ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        pass: false,
        error: (error as Error).message,
        stack: (error as Error).stack?.split("\n").slice(0, 6),
        runtime: { name: "nodejs", node: process.version, vercel: process.env["VERCEL"] === "1" },
      },
      { status: 500 },
    );
  }
}
