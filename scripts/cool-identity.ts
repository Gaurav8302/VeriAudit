/**
 * Generates `lib/cool/identity.generated.ts` — VeriAudit's published, pinnable
 * evidence-plane identity.
 *
 *   COOL_IMAGE_DIGEST=sha256:veriaudit-r2-v1 npm run cool:identity
 *
 * The output is safe to commit: it is public keys and a public measurement,
 * derived deterministically with no secret involved. Committing it is what
 * makes verification meaningful — the pin has to live somewhere an attacker
 * cannot move by setting an environment variable.
 *
 * See docs/DEPLOYMENT.md §4 ("The identity coupling").
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { SimulatedDstackClient, sealedKeyset } from "cool-nwc/phala";
import { APP_ID, IMAGE_DIGEST, LOG_ID } from "../lib/cool/config";

async function main() {
  const client = new SimulatedDstackClient({ appName: APP_ID, imageDigest: IMAGE_DIGEST });
  const [info, keys] = await Promise.all([client.info(), sealedKeyset(client)]);

  // The simulator's own root public key. It must be published too: without it
  // the `attestation` domain cannot verify the simulated quote signature.
  const simRoot = client.directory();

  const keyDirectory = {
    [keys.record.keyId]: keys.record.directoryEntry,
    [keys.log.keyId]: keys.log.directoryEntry,
    ...simRoot,
  };

  const source = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with:  COOL_IMAGE_DIGEST=${IMAGE_DIGEST} npm run cool:identity
 *
 * VeriAudit's published evidence-plane identity. Public keys and a public
 * measurement, derived deterministically from (applicationId, imageDigest).
 * Committed on purpose: this is the trust anchor verification pins against.
 */
import type { Measurement } from "cool-nwc";
import type { KeyDirectory } from "./key-directory";

/** The (applicationId, imageDigest) pair this identity was generated for. */
export const GENERATED_FOR = {
  applicationId: ${JSON.stringify(APP_ID)},
  imageDigest: ${JSON.stringify(IMAGE_DIGEST)},
  logId: ${JSON.stringify(LOG_ID)},
} as const;

/** The measurement of the approved image. Pinned at verification time. */
export const EXPECTED_MEASUREMENT: Measurement = ${JSON.stringify(info.measurement, null, 2)};

/** Everything a verifier needs, merged OVER a receipt's self-asserted keys. */
export const PUBLISHED_KEY_DIRECTORY: KeyDirectory = ${JSON.stringify(keyDirectory, null, 2)};

/** The only key ids allowed to have signed a VeriAudit record. */
export const TRUSTED_RECORD_KEY_IDS: readonly string[] = [${JSON.stringify(keys.record.keyId)}];

/** The only key id allowed to have signed a VeriAudit tree head. */
export const TRUSTED_LOG_KEY_IDS: readonly string[] = [${JSON.stringify(keys.log.keyId)}];
`;

  const out = join(process.cwd(), "lib", "cool", "identity.generated.ts");
  writeFileSync(out, source, "utf8");

  console.log(`wrote ${out}`);
  console.log(`  applicationId : ${APP_ID}`);
  console.log(`  imageDigest   : ${IMAGE_DIGEST}`);
  console.log(`  logId         : ${LOG_ID}`);
  console.log(`  record key    : ${keys.record.keyId}`);
  console.log(`  log key       : ${keys.log.keyId}`);
  console.log(`  sim root key  : ${Object.keys(simRoot).join(", ") || "(none)"}`);
  console.log(`  mrtd          : ${info.measurement.mrtd.slice(0, 32)}…`);
  console.log(`  runtime mode  : ${info.mode}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
