// Does the identity-drift assertion actually fire? Run with a WRONG digest:
//   COOL_IMAGE_DIGEST=sha256:wrong node cool-proof/probe-drift.mjs
// Expected: recordEvents rejects before sealing anything.
process.env.COOL_IMAGE_DIGEST = "sha256:definitely-not-the-pinned-image";

const { recordEvent } = await import("../lib/cool/recorder.ts");
const { sampleEvent } = await import("../lib/proof/sample-trail.ts");

try {
  await recordEvent(sampleEvent(), []);
  console.log("FAIL — recording succeeded under an unpinned identity");
  process.exit(1);
} catch (error) {
  console.log("PASS — recording refused under an unpinned identity:\n");
  console.log(error.message);
}
