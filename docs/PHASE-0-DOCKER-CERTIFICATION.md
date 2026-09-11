# ORBI Creative Studio — Phase 0 Docker Certification

Certification date: 2026-09-11

Baseline:

- upstream commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- root tree: `3b4c89a044621ea677d9ceb477f301301a704cdf`
- certification run: `34651969348`

## Result

**PASS**

The pinned baseline was successfully built as a Docker image, started as a container, and reached through a local HTTP smoke test.

## Certification flow

1. exact baseline + recursive submodules checked out,
2. workflow-only divergence verified,
3. `docker build --pull` completed,
4. container started on port 3000,
5. HTTP GET to `http://127.0.0.1:3000/` succeeded,
6. container logs were captured,
7. container was removed cleanly.

## Runtime observation

Next.js reported:

`Ready in 529ms`

The HTTP smoke test reported:

`HTTP smoke test PASS`

## Interpretation

The baseline is not only statically buildable; its Docker/self-hosted web mode can start and serve the application successfully in a clean GitHub Actions environment.

This does not certify:

- cloud provider credentials,
- generation jobs,
- sd.cpp desktop inference,
- Wan2GP,
- external storage,
- production network hardening,
- persistent volumes.

Those remain separate capability tests.

## Security note

A successful container boot does not override the dependency audit findings. The web runtime still requires the dependency remediation tracked in issue #8 before ORBI should consider a public production deployment.
