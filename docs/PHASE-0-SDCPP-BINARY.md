# ORBI Creative Studio — Phase 0 sd.cpp Binary Certification

Certification date: 2026-09-11

Baseline application:

- upstream commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- certification run: `34654014449`

## Result

**PASS — Linux x64 binary resolution, download and execution**

The certification reproduced the same release-selection algorithm used by the pinned upstream:

1. query the latest 15 `leejet/stable-diffusion.cpp` releases,
2. enumerate zip assets,
3. call the upstream `pickBinaryAssetForPlatform` selector for Linux x64,
4. download the selected archive,
5. extract it,
6. locate `sd-cli`,
7. execute `sd-cli --help`.

## Binary selected on 2026-09-11

Release:

- tag: `master-859-7f410a3`
- GitHub release ID: `387320995`

Archive:

- `sd-master-7f410a3-bin-Linux-Ubuntu-24.04-x86_64.zip`
- GitHub asset ID: `557971626`
- asset size: `33,224,779` bytes
- SHA-256: `3f3e1a6b57a2e4d184aa9ea9ab916272ea92b4b79d5af667cad89d0a3edc2bc7`

Extracted CLI:

- filename: `sd-cli`
- size observed: `1,376,032` bytes
- SHA-256: `5364b079ba9ac3beae4d2ff35c6a7c1904408d3f950b6b295cabdbebb414e155`
- reported commit: `7f410a3`

Execution evidence:

```
stable-diffusion.cpp version unknown, commit 7f410a3
Usage: sd-cli [options]
SDCPP_BINARY_EXECUTION_PASS
```

## Interpretation

The current upstream selector resolves to an executable Linux x64 runtime that works on a clean Ubuntu 24.04 GitHub runner.

This certifies:

- release discovery,
- platform asset selection,
- archive download,
- archive extraction,
- binary execution.

It does **not** yet certify:

- an actual model load,
- image generation,
- Vulkan/CUDA acceleration,
- memory requirements,
- ORBI target hardware,
- Android/Termux.

## Reproducibility finding

The upstream algorithm is **time-dependent**.

The exact same Open Generative AI application release can resolve to a different sd.cpp release later because it scans recent upstream releases dynamically.

ORBI should therefore pin a reviewed runtime asset and hash before public release.

Recommended manifest entry:

```json
{
  "runtime": "stable-diffusion.cpp",
  "platform": "linux-x64",
  "upstream_commit": "7f410a3",
  "archive_sha256": "3f3e1a6b57a2e4d184aa9ea9ab916272ea92b4b79d5af667cad89d0a3edc2bc7",
  "sd_cli_sha256": "5364b079ba9ac3beae4d2ff35c6a7c1904408d3f950b6b295cabdbebb414e155"
}
```

A future ORBI runtime update should be a reviewed provenance change, not an implicit consequence of release order on GitHub.
