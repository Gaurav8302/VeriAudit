/**
 * The tamper matrix. Proof-only — nothing in the product imports this.
 *
 * Shared by `tests/cool-adapter.test.ts` and `GET /api/cool/selftest` so that
 * the assertions running on Vercel are the SAME assertions running locally.
 * That is the point of the Vercel gate: not "the route responded", but "the
 * identical matrix produced the identical results".
 */
import { CoolTee, SimulatedDstackClient, recordLeafDataV2, sealedKeyset } from "cool-nwc/phala";
import { MemoryLog } from "cool-nwc";
import { APP_ID, LOG_ID } from "@/lib/cool/config";
import { EXPECTED_MEASUREMENT, PUBLISHED_KEY_DIRECTORY } from "@/lib/cool/identity";
import type { KeyDirectory } from "@/lib/cool/key-directory";
import { PRODUCTION_POLICY, verifyReceipt, type TrustPolicy } from "@/lib/cool/verifier";
import type { IntegrityState } from "@/lib/cool/types";

/** A deep clone that keeps the receipt's exact structure. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Flip one hex character, guaranteeing a change whatever the original was. */
export function flipLastHex(value: string): string {
  const last = value.slice(-1);
  return value.slice(0, -1) + (last === "0" ? "1" : "0");
}

/**
 * A receipt from a DIFFERENT evidence plane: internally consistent, honestly
 * signed, and not ours. This is the forgery that matters — CONFIRMED in
 * discovery to pass naive `verifyEvidence` with `ok: true` and zero reasons.
 */
export async function foreignReceipt(
  type = "finding.created",
  imageDigest = "sha256:not-veriaudit-attacker-build",
): Promise<{ receipt: any; keyDirectory: KeyDirectory; recordKeyId: string; measurement: any }> {
  const dstack = new SimulatedDstackClient({ appName: "definitely-not-veriaudit", imageDigest });
  const [info, keys] = await Promise.all([dstack.info(), sealedKeyset(dstack)]);
  const log = new MemoryLog(LOG_ID, keys.log);
  const tee = await CoolTee.connect({
    app: { name: "definitely-not-veriaudit", imageDigest },
    dstack,
    log,
  });
  try {
    const receipt = await tee.record({
      type,
      executionId: "EXEC-FORGED-001",
      metadata: { schema: "veriaudit.event.v1", note: "forged" },
      software: { name: "veriaudit-audit-engine", version: "0.1.0", digest: null },
    });
    return {
      receipt,
      keyDirectory: {
        [keys.record.keyId]: keys.record.directoryEntry,
        [keys.log.keyId]: keys.log.directoryEntry,
        ...(dstack.directory() as KeyDirectory),
      },
      recordKeyId: keys.record.keyId,
      measurement: info.measurement,
    };
  } finally {
    await tee.close();
  }
}

export interface TamperCase {
  readonly id: string;
  readonly name: string;
  /** What the application-level verdict must be. */
  readonly expect: "VERIFIED" | "FAILED";
  /** Which application check must be the one that fails. */
  readonly expectFailure?: IntegrityState["failures"][number]["check"];
  /**
   * What the SDK's own verdict does here. `true` on a FAILED case is the
   * interesting column: it is a case CooL accepts and VeriAudit rejects.
   */
  readonly expectCoolVerdictOk?: boolean;
  readonly run: () => Promise<IntegrityState>;
}

/** Build the matrix against one genuine receipt from VeriAudit's own plane. */
export async function tamperCases(genuine: unknown): Promise<TamperCase[]> {
  const foreign = await foreignReceipt();

  /** Trusts the forger's keys but pins OUR measurement. Isolates §6 check 2. */
  const measurementOnlyPolicy: TrustPolicy = {
    expectedMeasurement: EXPECTED_MEASUREMENT,
    publishedKeyDirectory: { ...PUBLISHED_KEY_DIRECTORY, ...foreign.keyDirectory },
    trustedRecordKeyIds: new Set([foreign.recordKeyId]),
  };

  /** Pins the forger's measurement but keeps OUR allow-list. Isolates check 3. */
  const allowListOnlyPolicy: TrustPolicy = {
    expectedMeasurement: foreign.measurement,
    publishedKeyDirectory: { ...PUBLISHED_KEY_DIRECTORY, ...foreign.keyDirectory },
    trustedRecordKeyIds: PRODUCTION_POLICY.trustedRecordKeyIds,
  };

  return [
    {
      id: "T1",
      name: "genuine receipt, production policy",
      expect: "VERIFIED",
      expectCoolVerdictOk: true,
      run: () => verifyReceipt(genuine),
    },
    {
      id: "T2",
      name: "altered evidence: finding severity rewritten in the committed metadata",
      expect: "FAILED",
      expectFailure: "cool",
      expectCoolVerdictOk: false,
      run: () => {
        const bad = clone(genuine) as any;
        // The metadata itself is not in the receipt (it is salted-hashed), so the
        // realistic alteration is to the commitment that stands for it.
        bad.record.event.input_commitment = flipLastHex(
          bad.record.event.input_commitment ?? bad.binding_hash,
        );
        return verifyReceipt(bad);
      },
    },
    {
      id: "T3",
      name: "altered evidence: binding hash rewritten",
      expect: "FAILED",
      expectFailure: "cool",
      expectCoolVerdictOk: false,
      run: () => {
        const bad = clone(genuine) as any;
        bad.binding_hash = flipLastHex(bad.binding_hash);
        return verifyReceipt(bad);
      },
    },
    {
      id: "T4",
      name: "wrong measurement: honestly signed receipt from another build",
      expect: "FAILED",
      expectFailure: "measurement",
      // The forger's own plane signs consistently; only our pin rejects it.
      expectCoolVerdictOk: false,
      run: () => verifyReceipt(foreign.receipt, measurementOnlyPolicy),
    },
    {
      id: "T5",
      name: "wrong key: receipt signed by a key outside the allow-list",
      expect: "FAILED",
      expectFailure: "signer",
      run: () => verifyReceipt(foreign.receipt, allowListOnlyPolicy),
    },
    {
      id: "T6",
      name: "missing inclusion: receipt claims it was never logged (inclusion/sth = null)",
      expect: "FAILED",
      expectFailure: "inclusion",
      // THE critical case. CONFIRMED: ok=true, ZERO reasons, inclusion=absent.
      // An attacker deletes the proof that a record was ever logged and CooL
      // raises no objection, because `ok` tolerates `inclusion: absent`.
      expectCoolVerdictOk: true,
      run: () => {
        const bad = clone(genuine) as any;
        bad.inclusion = null;
        bad.sth = null;
        return verifyReceipt(bad);
      },
    },
    {
      id: "T6b",
      name: "inclusion and sth keys removed entirely",
      expect: "FAILED",
      expectFailure: "cool",
      // Contrast with T6: `undefined` fails the structural validator where
      // `null` passes it. The same asymmetry as software.digest (§7.1).
      expectCoolVerdictOk: false,
      run: () => {
        const bad = clone(genuine) as any;
        delete bad.inclusion;
        delete bad.sth;
        return verifyReceipt(bad);
      },
    },
    {
      id: "T7",
      name: "forged inclusion: leaf index moved within the tree",
      expect: "FAILED",
      expectFailure: "inclusion",
      expectCoolVerdictOk: false,
      run: () => {
        const bad = clone(genuine) as any;
        bad.inclusion.leaf_index = (bad.inclusion.leaf_index ?? 0) + 1;
        return verifyReceipt(bad);
      },
    },
    {
      id: "T8",
      name: "forged tree head: signed root hash rewritten",
      expect: "FAILED",
      expectFailure: "inclusion",
      expectCoolVerdictOk: false,
      run: () => {
        const bad = clone(genuine) as any;
        bad.sth.root_hash = flipLastHex(bad.sth.root_hash);
        return verifyReceipt(bad);
      },
    },
    {
      id: "T9",
      name: "key substitution in the receipt's own directory is neutralised by pinning",
      // VERIFIED is the CORRECT outcome here, and it is the point of
      // withTrustedKeys. The RECORD is untouched; only the receipt's
      // self-asserted public key was swapped. Pinning merges the real key back
      // over it, so the signature verifies and the evidence stands.
      //
      // Without pinning this genuine receipt would FAIL on signature — an
      // attacker who can edit a stored receipt could otherwise discredit
      // authentic evidence, which is a real denial-of-evidence attack.
      expect: "VERIFIED",
      expectCoolVerdictOk: true,
      run: () => {
        const bad = clone(genuine) as any;
        const keyId = bad.record.signature.key_id;
        const stolen = Object.values(foreign.keyDirectory)[0];
        bad.key_directory[keyId] = stolen;
        return verifyReceipt(bad);
      },
    },
    {
      id: "T9b",
      name: "forgery re-signed by the attacker but claiming VeriAudit's key id",
      expect: "FAILED",
      expectFailure: "cool",
      // The attack T9's defence is FOR: the forger signs with their own key and
      // relabels it as ours, so the allow-list is satisfied. Pinning restores
      // the real public key, and the signature check then fails.
      expectCoolVerdictOk: false,
      run: () => {
        const ourKeyId = [...PRODUCTION_POLICY.trustedRecordKeyIds][0]!;
        const bad = clone(foreign.receipt) as any;
        const forgerEntry = bad.key_directory[bad.record.signature.key_id];
        bad.record.signature.key_id = ourKeyId;
        bad.key_directory[ourKeyId] = forgerEntry;
        return verifyReceipt(bad);
      },
    },
    {
      id: "T10",
      name: "software identity stripped (the digest: null workaround removed)",
      expect: "FAILED",
      expectFailure: "cool",
      expectCoolVerdictOk: false,
      run: () => {
        const bad = clone(genuine) as any;
        delete bad.record.event.software.digest;
        return verifyReceipt(bad);
      },
    },
    {
      id: "T11",
      name: "not a receipt at all",
      expect: "FAILED",
      expectFailure: "shape",
      run: () => verifyReceipt("nope"),
    },
  ];
}

export interface TamperCaseResult {
  readonly id: string;
  readonly name: string;
  readonly expect: string;
  readonly actual: "VERIFIED" | "FAILED";
  readonly pass: boolean;
  readonly coolVerdictOk: boolean;
  readonly failures: readonly string[];
  readonly note: string | null;
}

/** Run the whole matrix and report. Used by the self-test route. */
export async function runTamperMatrix(
  genuine: unknown,
): Promise<{ allPass: boolean; results: TamperCaseResult[] }> {
  const cases = await tamperCases(genuine);
  const results: TamperCaseResult[] = [];

  for (const testCase of cases) {
    const state = await testCase.run();
    const actual = state.ok ? "VERIFIED" : "FAILED";
    const checks = state.failures.map((f) => f.check);
    const failureMatches =
      testCase.expectFailure === undefined || checks.includes(testCase.expectFailure);
    const verdictMatches =
      testCase.expectCoolVerdictOk === undefined ||
      state.verdictOk === testCase.expectCoolVerdictOk;

    results.push({
      id: testCase.id,
      name: testCase.name,
      expect: testCase.expect,
      actual,
      pass: actual === testCase.expect && failureMatches && verdictMatches,
      coolVerdictOk: state.verdictOk,
      failures: state.failures.map((f) => `${f.check}: ${f.reason}`),
      note:
        actual === "FAILED" && state.verdictOk
          ? "CooL accepted this receipt; VeriAudit rejected it"
          : null,
    });
  }

  return { allPass: results.every((r) => r.pass), results };
}
