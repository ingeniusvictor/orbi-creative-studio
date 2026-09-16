# ORBI Creative Studio — Local Model Provenance Manifest v1

Status: governance baseline for MODEL-01.

## Purpose

`electron/lib/modelProvenance.json` is the machine-readable source-of-truth for provenance and integrity facts about local sd.cpp model assets used by ORBI Creative Studio.

The manifest separates three different questions that must not be conflated:

1. **What exact file did ORBI intend to use?**
2. **What license does the upstream repository declare?**
3. **Has ORBI explicitly approved commercial use or redistribution?**

A declared upstream license is recorded as evidence. It is not automatically converted into an ORBI legal approval.

## Required fields

Every asset records:

- stable ORBI asset ID
- asset role
- runtime
- local filename
- Hugging Face repository
- observed immutable revision
- source path
- exact expected byte size
- SHA-256
- upstream-declared license
- license review state
- ORBI commercial-use decision
- ORBI redistribution decision
- minimum tested RAM/VRAM
- verification date/status
- physical hardware certification status

## Current assets

| Asset | Bytes | SHA-256 status | Declared license | ORBI redistribution |
|---|---:|---|---|---|
| Z-Image Turbo Q4_K | 3,864,250,304 | verified | apache-2.0 | unreviewed |
| Z-Image Base Q4_K_M | 5,066,995,776 | verified | apache-2.0 | unreviewed |
| DreamShaper 8 | 2,132,625,894 | verified | other | **blocked** |
| Realistic Vision 5.1 fp16 no-EMA | 2,132,625,894 | verified | creativeml-openrail-m | unreviewed |
| Anything v5 PRT | 2,132,625,616 | verified | creativeml-openrail-m | unreviewed |
| SDXL Base 1.0 | 6,938,078,334 | verified | openrail++ | unreviewed |
| Qwen3 4B UD-Q4_K_XL text encoder | 2,546,340,960 | verified | apache-2.0 | unreviewed |
| Z-Image VAE | 335,304,388 | verified | apache-2.0 | unreviewed |

## DreamShaper gate

The upstream Hugging Face repository currently declares license `other`.

ORBI therefore records:

- `redistribution: blocked`
- `distributionGate: blocked-pending-license-clarification`

This is a product-governance stop rule, not a claim about what a court would decide.

## Hardware claims

All `minimumTestedRamMiB` and `minimumTestedVramMiB` fields remain null.

They must stay null until a physical target machine produces repeatable generation evidence. File size, parameter count, total system RAM, or detected GPU presence are not substitutes for actual runtime certification.

## Drift protection

CI verifies that:

- every desktop sd.cpp model has a provenance record;
- local filename, byte size and SHA-256 agree with the desktop catalog;
- Z-Image auxiliary assets agree with provenance;
- renderer model metadata mirrors exact byte size and SHA-256;
- every asset uses a valid 64-character SHA-256;
- DreamShaper cannot accidentally become redistributable;
- a declared upstream license cannot silently become an ORBI approval.

## Next supply-chain step

Use the manifest to verify SHA-256 after model/auxiliary download and before promoting a downloaded file into the usable model directory.

That enforcement should be implemented separately so provenance governance and downloader behavior remain independently reviewable.
