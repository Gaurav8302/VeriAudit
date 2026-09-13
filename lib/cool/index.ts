/**
 * The CooL adapter boundary.
 *
 * Everything in VeriAudit that needs cryptographic evidence goes through this
 * module. Nothing outside `lib/cool/` imports `cool-nwc` — guideline Rule 3,
 * enforced by a test.
 *
 * `server-only` lives here rather than in the individual modules so that the
 * Next build fails if a client component ever imports the adapter (which would
 * ship ~230 KB of post-quantum crypto to the browser), while the unit tests can
 * still import the submodules directly.
 */
import "server-only";

export { canonicalEventPayload, contentDigest } from "./canonical";
export { APP_ID, IMAGE_DIGEST, LOG_ID, SOFTWARE_NAME, SOFTWARE_VERSION, dstackEndpointIsSet } from "./config";
export {
  EXPECTED_MEASUREMENT,
  GENERATED_FOR,
  PUBLISHED_KEY_DIRECTORY,
  TRUSTED_RECORD_KEY_IDS,
  TRUSTED_RECORD_KEY_ID_SET,
  assertIdentityMatchesPin,
  describeIdentity,
  measurementDiff,
  measurementMatchesPin,
  sealedKeys,
} from "./identity";
export { assertValidLogState, proveAppendOnly, rehydrate } from "./log-state";
export type { LogState } from "./log-state";
export { recordEvent, recordEvents } from "./recorder";
export type { RecordResult } from "./recorder";
export { FAILED_CLAIM, VERIFIED_CLAIM, verifyReceipt, verifyReceipts } from "./verifier";
export type * from "./types";
