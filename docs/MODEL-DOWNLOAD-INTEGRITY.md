# ORBI Creative Studio — Model Download Integrity v1

Status: stacked security change on top of MODEL-01. No Compute Router / Studio generation wiring.

## Goal

A local model or Z-Image auxiliary file must not become usable merely because an HTTP transfer completed.

The downloader now uses a two-stage promotion boundary:

1. download/resume into `.pending-verification.part`;
2. complete transfer into `.pending-verification`;
3. resolve the asset against `modelProvenance.json`;
4. require exact byte size;
5. require exact SHA-256;
6. atomically rename to the final catalog filename only after both checks pass.

The Studio continues to treat only the final catalog filename as `downloaded`.

## Fail-closed behavior

- missing provenance → reject;
- catalog/provenance size drift → reject;
- catalog/provenance SHA drift → reject;
- downloaded byte-size mismatch → delete complete unverified stage and reject;
- SHA-256 mismatch → delete complete unverified stage and reject;
- destination race / overwrite attempt → reject;
- transport interruption → retain only the partial staged transfer so range-resume remains possible.

## Scope boundary

This change does not:

- select providers;
- alter Compute Router policy;
- execute generation differently;
- add cloud fallback;
- change MuAPI credential handling;
- certify physical GPU/RAM requirements.

It only changes when a freshly downloaded local asset is promoted to the filename that existing Studio code already recognizes as usable.

## Dependency

This change depends on MODEL-01 because the provenance manifest is the integrity authority. Keep it stacked until MODEL-01 is green and merged.
