# ORBI Creative Studio — Release Gates

These gates apply to any future ORBI-branded public release.

## G0 — Provenance

Required:

- immutable upstream baseline identified
- ORBI changes attributable to reviewed branches/PRs
- third-party code notices retained
- model/runtime sources recorded

## G1 — Build integrity

Required:

- dependency installation PASS
- root tests PASS
- workspace builds PASS
- Next.js build PASS
- Electron renderer build PASS
- target desktop package build PASS
- Docker build/smoke PASS when web distribution is in scope

## G2 — Runtime security

Required for public release:

- 0 critical production dependency findings
- 0 unreviewed high production dependency findings
- no committed secret-pattern findings
- Electron external-link scheme validation
- Wan2GP endpoint trust validation
- provider-secret handling reviewed
- downloaded binary/model integrity policy implemented

## G3 — Distribution security

Windows:

- production installer generated
- clean install verified
- uninstall/upgrade path verified
- code signing configured for public distribution

macOS:

- package generated
- signing/notarization strategy defined for public distribution

Linux:

- AppImage/DEB generation verified
- package metadata reviewed

## G4 — Licensing

Required:

- root MIT notice preserved
- submodule notices documented
- unresolved model-weight licenses excluded from ORBI redistribution
- model commercial/redistribution rights tracked per weight

## G5 — Local inference

Before advertising local image generation:

- runtime binary provenance recorded
- binary hash validation implemented
- at least one supported model generated successfully on target hardware
- RAM/disk/runtime behavior measured
- failure/OOM behavior documented

Before advertising local video generation:

- Wan2GP or replacement runtime tested against a real supported GPU node
- privacy/network boundary documented
- model availability/readiness probes verified

## G6 — ORBI Edge

Before Android/Edge claims:

- Compute Router contracts implemented
- node trust/capability protocol defined
- device capability probe implemented
- actual POCO/Termux tests recorded
- unsupported workloads explicitly rejected rather than attempted blindly

## G7 — Branding/update channel

Before public ORBI desktop distribution:

- application/product name changed intentionally
- package/app IDs changed
- icons/assets changed
- upstream attribution retained
- update publisher/repository moved to ORBI-controlled endpoints
- installer paths reviewed for migration/collision risk

## Current position

Phase 0 proves the upstream foundation is viable, but these release gates deliberately prevent a successful build from being mistaken for a production-ready ORBI product.
