# Deployment

Based on the actual SDK compatibility findings in `COOL_SDK_AUDIT.md` §9, not on
assumption. Round 2 requires a working Vercel link, and per the source of truth
§11 deployment must not be left to the final hour.

---

## 1. Architecture

**One Vercel project. Next.js frontend + Next.js Route Handlers on the Node.js
runtime. No separate backend. No database. No external services.**

```text
Vercel project "veriaudit"
├── Static + RSC        onboarding, audit, history, trail UI
├── Route handlers      /api/audit/run, /api/cool/verify,
│   (Node.js runtime)   /api/cool/consistency, /api/cool/identity
└── Client storage      IndexedDB (receipts + log state)
```

The five findings that make this the right shape rather than a compromise:

1. The `cool-nwc` main entry reaches 27 files and imports **zero `node:`
   builtins** — no filesystem, no sockets, no daemon.
2. It makes **no network calls of its own** — no egress allowlist, no outbound
   latency.
3. Signing keys are a **pure function of `(applicationId, COOL_IMAGE_DIGEST)`** —
   `CONFIRMED` byte-identical on re-derivation. A stateless function fleet signs
   under one stable identity with **no secret to store**.
4. Receipts are **self-contained** — `CONFIRMED` verifiable by a different client
   instance and by standalone `verifyEvidence` with no client at all. So a
   cold-started function verifies correctly.
5. The transparency tree rehydrates from an **ordered list of public binding
   hashes** — which fits in the session, so no database is needed for the
   `inclusion` domain to stay meaningful.

A separate long-running backend would buy nothing. The only thing that genuinely
requires one — `attestation.provider: "dstack"` inside a CVM — is P2 in the
source of truth and is impossible on Vercel regardless.

---

## 2. Runtime choice

Every route that touches `cool-nwc` declares:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

| Option | Verdict |
|---|---|
| **Node.js runtime** | **CHOSEN.** `CONFIRMED` locally on Node 22. Node ≥ 20 satisfies `engines`. ML-DSA-65 keygen and signing are CPU-bound and the Node runtime has the headroom |
| Edge runtime | rejected. `INFERRED` to be technically possible (no Node builtins, WebCrypto available) but the vendor's `troubleshooting.md` says browser/edge is *"not currently tested — don't rely on it"*, and Edge CPU limits are a poor fit for post-quantum signing. Nothing we need requires Edge |
| Client-side only | rejected as the authoritative path. `CONFIRMED` to work in Chromium (162 ms record, 22 ms verify), kept as a P1 "verify it yourself" affordance |

Vercel's default Node version must be **20.x or 22.x**. Set explicitly in
`package.json`:

```json
{ "engines": { "node": ">=20" } }
```

---

## 3. Build configuration

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Install command | `npm install` |
| Build command | `next build` (Vercel default) |
| Output | `.next` (default) |
| Root directory | repository root |
| Node version | 22.x |

`next.config.ts` needs no special handling for `cool-nwc` — Next 15 bundles ESM
server dependencies by default. `TODO`: if the server build ever tries to
externalise it and fails at runtime, the escape hatch is
`serverExternalPackages` in `next.config.ts`. Do not add it pre-emptively.

TypeScript must use `"moduleResolution": "bundler"` (or `"nodenext"`) — the SDK
ships `.d.ts` tested only under those, and `"node10"` will fail to resolve types.
There is **no CommonJS build**: any `require("cool-nwc")` breaks.

`cool-sdk/` is excluded from the build and from git (`.gitignore`), since it is a
separate upstream repository with its own `.git`. `cool-proof/` is committed but
excluded from the Next build via `tsconfig` excludes — it is standalone `.mjs`.

---

## 4. Environment variables

No secrets. Nothing here is sensitive, so the same values are safe in
`.env.example`, in Vercel, and in the README.

| Variable | Value | Scope | Required | Purpose |
|---|---|---|---|---|
| `COOL_APP_ID` | `veriaudit` | server | no (defaults in code) | CooL `applicationId` |
| `COOL_IMAGE_DIGEST` | `sha256:veriaudit-r2-v1` | server | **yes** | seeds the simulated measurement. **Must match the value used to generate `lib/cool/identity.ts`**, or `expectedMeasurement` pinning and the `key_id` allow-list will reject every receipt |
| `COOL_LOG_ID` | `veriaudit-log` | server | no | recorded in every STH |
| `COOL_DSTACK_ENDPOINT` | **must be unset** | server | — | `CONFIRMED`: if set, the provider resolves to `dstack` even without `attestation.provider`, and every request fails with `DstackUnavailableError` |
| `NEXT_PUBLIC_APP_VERSION` | e.g. `0.1.0` | client | no | shown in the UI and in `software.version` |

`.env.example`:

```sh
# CooL evidence plane (local simulator — no hardware, no secrets)
COOL_APP_ID=veriaudit
COOL_IMAGE_DIGEST=sha256:veriaudit-r2-v1
COOL_LOG_ID=veriaudit-log

# Leave COOL_DSTACK_ENDPOINT UNSET. Setting it forces the dstack provider,
# which cannot reach a guest agent on Vercel and fails every request.
# COOL_DSTACK_ENDPOINT=

NEXT_PUBLIC_APP_VERSION=0.1.0
```

`security.requireAttestation` is never set — `CONFIRMED` that combining it with
`provider: "local"` throws `ConfigurationError` at construction.

### The identity coupling

`lib/cool/identity.ts` holds `PUBLISHED_KEY_DIRECTORY`, `TRUSTED_KEY_IDS`, and
`EXPECTED_MEASUREMENT` as committed constants. They are generated **once** by a
script against a fixed `COOL_IMAGE_DIGEST`:

```sh
COOL_IMAGE_DIGEST=sha256:veriaudit-r2-v1 npm run cool:identity
```

This is safe to commit — they are public keys and public measurements, derived
deterministically with no secret. But it creates a hard rule: **changing
`COOL_IMAGE_DIGEST` in production without regenerating `identity.ts` breaks all
verification.** A startup assertion compares the live
`cool.environment.measurement` against `EXPECTED_MEASUREMENT` and logs loudly on
mismatch, so this fails visibly in dev rather than silently in the demo.

---

## 5. Server / client boundary

| Concern | Runs where | Why |
|---|---|---|
| CooL recording (`cool.record`) | **server** | authoritative signing identity; keeps `COOL_IMAGE_DIGEST` server-side |
| CooL verification (authoritative) | **server** | `/api/cool/verify` |
| Transparency log rehydration | **server**, from client-supplied `logState` | `append()` is synchronous, so the tree must be in memory |
| Deterministic corpus generation | **both** | pure function of the seed; server and client produce identical data, so search and rendering need no round trip |
| Search index | **client** | instant results, no network in the most important interaction |
| Receipt storage | **client** (IndexedDB) | ~30 KB each rules out `localStorage` |
| Optional self-verification | client | P1 affordance only |

`lib/cool/` is server-only and marked with `import "server-only"` so a stray
client import fails the build rather than shipping 230 KB of post-quantum crypto
to the browser by accident.

---

## 6. Storage and external services

| | |
|---|---|
| Database | **none** |
| KV / Redis | **none** |
| Blob storage | **none** |
| External APIs | **none** |
| LLM provider | **none at runtime** — the audit is deterministic (source of truth §10) |
| Persistent state on the server | **none** — only a module-scope LRU receipt cache, best-effort on warm instances |

`CONFIRMED` that CooL itself requires no persistence: keys are re-derived and
every receipt carries the public keys needed to verify it.

`TODO`/P1 fallback if the Milestone 8 Vercel test shows the session model is
fragile: Upstash Redis behind the same `lib/store` interface. Deliberately not
built up front — it adds provisioning and env vars for a demo that does not need
them.

---

## 7. Local development

```sh
git clone <repo>
cd veriaudit
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

```sh
npm run cool:proof     # run the SDK proof harnesses (real record + verify)
npm run cool:identity  # regenerate lib/cool/identity.ts
npm run typecheck
npm test
```

No Docker, no database to start, no dstack simulator, no API keys. `npm install`
needs network; nothing else does.

---

## 8. Production behaviour

| Scenario | Behaviour |
|---|---|
| Fresh browser, no cache | starts at Stage 1 and regenerates the corpus; receipts are created live in Stage 3. Nothing to have lost |
| Reload mid-demo | corpus regenerates identically (seeded); receipts and `logState` are restored from IndexedDB |
| Cold function start | ~102 ms extra for key derivation, then ~17 ms/record. `INFERRED` from local measurement; `TODO` confirm on Vercel |
| Two concurrent judges | independent sessions. Same signing identity (deterministic keys), separate trees — correct and expected |
| Function timeout | 9 `record()` calls ≈ 150 ms, far inside the default 10 s limit |
| IndexedDB blocked / private mode | receipts fall back to in-memory for the session; verification still works until reload. Surfaced as *"receipt not in this session"*, never as a verification failure |
| `COOL_IMAGE_DIGEST` mismatch | every verification fails loudly with `measurement does not match the pinned image`. The startup assertion catches it first |

---

## 9. Deployment sequence

Per guideline §4 Phase 8 — deploy early enough to discover runtime problems.

1. **Milestone 1 (hour 1).** Push the repo and deploy a skeleton with only
   `/api/cool/identity` + one route that records and verifies a single event.
   This proves `cool-nwc` runs on Vercel's Node runtime **before** any UI exists.
   If it fails, everything else waits.
2. **Milestones 2–7.** Every push auto-deploys to a preview URL.
3. **Milestone 8 (hour 7).** Full production verification against the checklist
   below.
4. Put the production URL in the README.

### Deployment checklist

```text
[ ] npm install succeeds on Vercel (no native build)
[ ] Node 22.x runtime in use
[ ] COOL_IMAGE_DIGEST set and matching identity.ts
[ ] COOL_DSTACK_ENDPOINT is NOT set
[ ] /api/cool/identity returns the expected key ids and measurement
[ ] POST /api/audit/run returns 9 receipts
[ ] POST /api/cool/verify returns ok: true for a real receipt
[ ] POST /api/cool/verify returns ok: false for a mutated receipt
[ ] inclusion status is "pass" (not "absent") on production receipts
[ ] full demo path works in a clean browser (see TESTING_PLAN.md)
[ ] cold-start timing acceptable
[ ] no secrets in the repo; .env.example present
[ ] cool-sdk/ is git-ignored and not in the build
```

---

## 10. Known deployment risks

| Risk | Severity | Mitigation |
|---|---|---|
| `cool-nwc` behaves differently on Vercel's Node runtime than locally | **high** — this is the only `INFERRED` link in the chain | tested in Milestone 1, hour 1, before any UI |
| ESM-only package trips the Next server bundle | medium | Next 15 handles ESM; `moduleResolution: "bundler"`; caught at build time |
| `COOL_IMAGE_DIGEST` drift breaks verification | medium | startup assertion + a test comparing the live measurement to `identity.ts` |
| Bundle bloat from `@noble/post-quantum` leaking client-side | medium | `import "server-only"` in `lib/cool/`; a test asserts no client component imports `cool-nwc` |
| Cold-start latency degrades the audit stage | low | ~102 ms; the staged UI absorbs it |
| IndexedDB unavailable | low | in-memory fallback, honestly labelled |
