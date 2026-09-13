# Product verification model

Verification is a server calculation. The frontend only displays it.

## Required checks

A product execution is VERIFIED only when all of these hold:

1. Each receipt passes `verifyReceipt` (`verdict.ok` is not enough).
2. The signing `key_id` is in VeriAudit's published allow-list.
3. The image measurement equals the pinned measurement.
4. Inclusion is `pass`.
5. Each event's salt-free `contentDigest` matches the digest stored at seal.
6. Each receipt sits at the claimed leaf in the public `logState`.
7. The RFC 6962 tree rehydrates to the captured root.
8. Event order and parent links still match the sealed chain.

## What VERIFIED means

The recorded execution history matches its cryptographic evidence.

It does **not** mean:

- the AI was correct
- a financial number is true
- someone was prevented from changing a live system
- hardware attestation occurred

This build remains `runtime.mode = simulated`. Attestation, enclave, witnesses,
and anchor are absent.

## What FAILED means

The stored historical record no longer matches the cryptographic commitment.

Typical causes in this product:

- rewriting a recorded AI action
- deleting an event / leaf
- changing an evidence fingerprint
- changing a finding
- changing a human review decision

That is not a claim that the original audit was hacked. It is a claim that the
stored copy no longer matches what was sealed.

## Tamper control

`Simulate historical tampering` exists only when `NODE_ENV` is not
`production` and `VERCEL_ENV` is not `production`. It mutates a copy during
the verify call. It does not rewrite the hero demo or persist corruption.

## Caching

The UI verifies after sealing, when a sealed execution is opened, and when the
user asks. It must not treat a previous `verified` result as permanent if the
seal bundle or workspace snapshot changes.
