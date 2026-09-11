# ORBI Creative Studio — Phase 0 Local Model Metadata Certification

Certification date: 2026-09-11

Run:

`34654551511`

## Result

**PASS — exact remote metadata captured without downloading model weights**

Hugging Face resolve endpoints were queried using HTTP `HEAD` with redirects disabled. For each LFS/Xet-backed file the response exposed:

- `x-linked-size`
- `x-linked-etag`
- `x-repo-commit`

These values have been written into:

`docs/model-provenance.baseline.json`

## Verified assets

| Asset | Exact bytes | SHA-256 / linked etag | Source revision |
|---|---:|---|---|
| Z-Image Turbo Q4_K | 3,864,250,304 | `14b375ab4f226bc5378f68f37e899ef3c2242b8541e61e2bc1aff40976086fbd` | `c61c0e422dc8b541b7548cf33a4ef8302b0f8085` |
| Z-Image Base Q4_K_M | 5,066,995,776 | `a62b929f76553b21f68894e9ed34d24b7fb67fb59b5689fa06981865986cce40` | `c9913e69743c5d9dfa7fdac58a0cc5709a17aa08` |
| Qwen3 4B text encoder | 2,546,340,960 | `4bbe1f2f8ebe69fad3be8e15d69f220b06448a9dd26f82d7d81cce88ebfc39fd` | `a06e946bb6b655725eafa393f4a9745d460374c9` |
| Z-Image VAE | 335,304,388 | `afc8e28272cd15db3919bacdb6918ce9c1ed22e96cb12c4d5ed0fba823529e38` | `08d04455279082882deaabc8d0d09fc914c071e1` |
| DreamShaper 8 | 2,132,625,894 | `879db523c30d3b9017143d56705015e15a2cb5628762c11d086fed9538abd7fd` | `228d79cb20811466f5c5710aa91f05dabd0b8a14` |
| Realistic Vision v5.1 | 2,132,625,894 | `99a75a901f4fec732056930a89fa34cf360f6f72d75ce5bf333ddf82adf8dd2a` | `1e9f017a7b1eaefb63a1900ea6c5953d2739fd21` |
| Anything v5 | 2,132,625,616 | `23b41e5091ffe1c9ee25f807771b6a007306fe185ecbc21d1fab835f5655a4f7` | `ca6595b27b8dce279b8f2b075a1e373907fda95b` |
| SDXL Base 1.0 | 6,938,078,334 | `31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b` | `462165984030d82259a11f4367a4eed129e94a7b` |

## Important corrections to upstream estimates

The upstream catalog currently lists:

- Z-Image Turbo: 2.5 GB
- Z-Image Base: 3.5 GB

Verified remote sizes are approximately:

- Z-Image Turbo: 3.864 GB decimal
- Z-Image Base: 5.067 GB decimal

These are material differences for:

- disk planning,
- mobile feasibility,
- download progress,
- memory expectations.

ORBI should use exact byte metadata rather than handwritten GB estimates.

## Provenance improvement

The upstream download URLs use `resolve/main`, which is mutable over time.

Because exact `x-repo-commit` revisions are now known, ORBI can later replace floating URLs with revision-pinned URLs and verify SHA-256 before accepting a download.

## Limitations

Metadata verification proves remote object identity and size; it does not prove:

- the model loads in sd.cpp,
- generation quality,
- RAM/VRAM requirements,
- legal redistribution rights.

Licensing remains tracked independently.
