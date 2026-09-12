# ORBI Creative Studio — Phase 1B.17 Parity Certification Build Binding

Status: stacked on P1B.16. Build identity binding only. No cutover authority.

## Purpose

Bind a P1B.9 parity certification snapshot to one exact Git commit SHA before it can be combined with release evidence.

The binding module lives at:

`src/lib/computeRouter/parityBuildBinding.mjs`

## Why this phase exists

P1B.16 binds CI/platform/security/rollback evidence to an exact source commit. Before P1B.17, the parity certification itself did not carry equivalent build identity.

P1B.17 closes that gap by wrapping the certification with:

- exact 40-character source commit;
- `studio-image-video-v1` profile ID;
- binding ID;
- binding timestamp;
- immutable certification snapshot.

## Certification integrity revalidation

The binding independently verifies:

- certification schema version 1;
- evidence age policy no weaker than P1B.9;
- future-skew policy no weaker than P1B.9;
- exact P1B.12 9-route profile;
- no duplicate route keys;
- route provider/operation identity;
- minimum sample thresholds;
- all samples are matches;
- zero blocked evidence;
- zero mismatch evidence;
- minimum model coverage;
- concrete model IDs;
- every route certified;
- global `PARITY_CERTIFIED` state.

Invalid certification can be represented only as:

`PARITY_CERTIFICATION_REJECTED`

## Snapshot semantics

The binding clones and freezes the certification snapshot so later mutation of the source object cannot alter the bound evidence.

Malformed route entries are omitted from the snapshot and cause integrity/profile failure rather than crashing binding creation.

## Extraction safety

`extractBoundCertification(binding, expectedSourceCommit)` revalidates the embedded certification instead of trusting the outer `bindingValid` flag.

Extraction fails closed when:

- expected commit does not match;
- profile does not match;
- binding ID/timestamp invalid;
- certification integrity fails;
- cutover authority is claimed;
- execution authority is not legacy-only.

## Authority boundary

Every binding preserves:

- `cutoverAuthorized: false`;
- `executionAuthority: legacy-dispatcher-only`.

## Scope boundary

P1B.17 does not:

- determine the current Git SHA automatically;
- write build metadata;
- query GitHub;
- alter session evidence collection;
- alter provider readiness;
- change Studio dispatch;
- approve cutover.

It defines the contract required to tie parity evidence to the same build identity used by P1B.16 release evidence.

## Merge gate

Keep stacked until P1B.3–P1B.16 are certified and merged.

Do not merge while GitHub Actions is failing before runner assignment with no executable steps/logs.