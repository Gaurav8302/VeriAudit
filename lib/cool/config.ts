/**
 * CooL plane configuration. See docs/DEPLOYMENT.md §4.
 *
 * These are all PUBLIC values — there are no secrets in VeriAudit, because
 * signing keys are derived from the measurement on every connect rather than
 * stored (docs/SECURITY_AND_CLAIMS.md §4).
 */

/** CooL `applicationId`. Feeds the simulated app id and key derivation. */
export const APP_ID = process.env["COOL_APP_ID"] ?? "veriaudit";

/**
 * THE input to the simulated measurement. Everything derived — measurement,
 * sealed keys, key ids — hangs off this string, so changing it changes the
 * plane's identity. It MUST match the value `identity.generated.ts` was built
 * against or every verification fails on the pinned measurement.
 */
export const IMAGE_DIGEST = process.env["COOL_IMAGE_DIGEST"] ?? "sha256:veriaudit-r2-v1";

/** Stable transparency-log id, recorded in every signed tree head. */
export const LOG_ID = process.env["COOL_LOG_ID"] ?? "veriaudit-log";

/** Recorded in cleartext as `record.event.software`. */
export const SOFTWARE_NAME = "veriaudit-audit-engine";
export const SOFTWARE_VERSION = process.env["NEXT_PUBLIC_APP_VERSION"] ?? "0.1.0";

/**
 * `COOL_DSTACK_ENDPOINT` must stay unset. CONFIRMED in the SDK's `client.ts`:
 * if it is set, the provider resolves to `dstack` even without an explicit
 * `attestation.provider`, and every request fails with DstackUnavailableError
 * because there is no guest agent on Vercel. VeriAudit never uses the
 * high-level client's provider resolution (it injects a SimulatedDstackClient
 * directly), but a set endpoint signals a misconfigured deployment.
 */
export function dstackEndpointIsSet(): boolean {
  return Boolean(process.env["COOL_DSTACK_ENDPOINT"]);
}
