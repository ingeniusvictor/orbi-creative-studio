# ORBI Foundation

This branch is the first integration candidate built from the certified upstream history.

Base security lineage:

- upstream baseline: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- Batch A lock-safe remediation: `7d852659d053995dbf9ca36b236854aac99406ab`
- Batch B1b PostCSS remediation: `cd9e3af39dc7a9028874043884acca3dbe073ad2`

Integrated validated changes:

- production dependency remediation with zero critical/high findings at B1b validation time,
- Electron external URL scheme hardening,
- Wan2GP endpoint trust-boundary validation,
- deterministic ESLint 9 configuration,
- lint warning ceiling of 11,
- URL-policy test coverage.

This branch intentionally does **not** yet include:

- ORBI branding,
- provider-secret storage migration,
- Compute Router implementation,
- ORBI Edge implementation,
- model/runtime download pinning,
- upstream documentation-history merge.

The purpose of this branch is to prove a hardened, reproducible technical foundation before ORBI product divergence.
