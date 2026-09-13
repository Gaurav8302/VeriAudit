/**
 * Re-exports of the SDK's key-directory types.
 *
 * `identity.generated.ts` is written by a script and read by the adapter, the
 * verifier, and the tests; routing its types through one local module keeps the
 * generated file's imports stable.
 *
 * These are the SDK's own types, not loosened copies. `cool-nwc` types public
 * keys as `base64:${string}` and multihashes as `mh:sha256:${string}`, which
 * catches a malformed pin at compile time — worth keeping.
 */
export type { DirectoryEntry, KeyDirectory } from "cool-nwc";
