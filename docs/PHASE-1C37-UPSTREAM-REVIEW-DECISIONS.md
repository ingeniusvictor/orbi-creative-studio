# P1C37 — Explicit Review Decisions & Baseline Advancement Gate

## Purpose

P1C37 defines the contract that sits between a generated P1C36 adoption manifest and any future baseline advancement.

P1C36 can only create `PENDING_REVIEW` entries. P1C37 accepts a separate, explicit decision submission and evaluates whether the reviewed upstream head is eligible to become a new reviewed baseline.

## Final decisions

Each changed path must receive exactly one explicit decision:

- `ADOPT`: the upstream change was adopted as a reviewed candidate.
- `ADAPT`: useful behavior was manually adapted to preserve ORBI architecture and trust boundaries.
- `REJECT`: the upstream change was reviewed and intentionally not incorporated.

No generated scanner output can make these decisions automatically.

## Review requirements

Every review domain required by the P1C36 manifest must be `APPROVED`.

For `ADOPT` and `ADAPT`, the submitted decision must also provide:

- implementation status `VERIFIED`
- a 40-character ORBI commit SHA containing the verified implementation

For `REJECT`:

- implementation status must be `NOT_APPLICABLE`
- no source mutation is required

A path that is not a P1C36 direct-adoption candidate can never use `ADOPT`.

## Baseline eligibility

Baseline advancement becomes eligible only when:

1. submitted baseline SHA matches the manifest baseline;
2. submitted upstream head matches the manifest head;
3. every manifest path has one final decision;
4. every required review is approved;
5. every adopted/adapted change has verified ORBI implementation evidence;
6. no ORBI-owned or otherwise restricted path is directly adopted.

Eligibility is a review result, not a repository mutation. P1C37 does not edit `upstreamDriftPolicy.mjs` or move the baseline.

## Scanner output

The live scanner emits a decision template with all decisions and reviews pending. This template is informational and explicitly non-authorizing.
