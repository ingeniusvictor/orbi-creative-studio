# ORBI Creative Studio — Phase 1B.20 Session Certification Build Binding

Status: stacked on P1B.19. Explicit session evidence binding only. No automatic execution.

## Purpose

Bind the current in-memory P1B.10/P1B.12 parity certification to the exact Electron build identity exposed by P1B.19.

## Renderer build identity client

`src/lib/computeRouter/buildIdentityClient.mjs` reads the static preload metadata `orbiBuildIdentity` and validates:

- schema version 1;
- `available: true`;
- exact 40-character source commit;
- non-empty app version.

Invalid or unavailable identity fails closed with `BUILD_IDENTITY_UNAVAILABLE` when a binding is requested.

## Session binding API

`bindCurrentStudioParitySessionToBuild()` is exported from `paritySession.mjs`.

It:

1. resolves the exact build identity;
2. evaluates the current fixed P1B.12 Studio target profile;
3. calls the P1B.17 build-binding contract;
4. returns either `PARITY_CERTIFICATION_BOUND` or `PARITY_CERTIFICATION_REJECTED`.

## Explicit-only behavior

P1B.20 does not call the binding function automatically.

`src/main.js`, ImageStudio and VideoStudio do not import or invoke it.

The existing shadow collector still starts exactly as before.

## Default binding identity

If the caller does not provide a binding ID, the session creates:

`studio-session:<sourceCommit>:<boundAt>`

This is an evidence identifier only. It is not an authorization token.

## Incomplete session behavior

An empty or incomplete session does not invent certification.

It produces a P1B.17 rejected binding with:

`PARITY_CERTIFICATION_REJECTED`

## Complete session behavior

When the current session satisfies all 9 P1B.12 routes and P1B.9 certification requirements, the binding can become:

`PARITY_CERTIFICATION_BOUND`

to the exact P1B.19 source commit.

## Privacy

The binding contains normalized certification evidence only.

Prompts, API keys, media URLs and generation payload fields are already removed by the P1B.9 evidence boundary and are not reintroduced.

## Authority boundary

The resulting binding continues to enforce:

- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

## Scope boundary

P1B.20 does not:

- persist session evidence;
- create release evidence;
- approve CI/security/rollback;
- automatically create a review bundle;
- alter routing or provider selection;
- execute generation;
- authorize cutover.

## Merge gate

Keep stacked until P1B.3–P1B.19 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.