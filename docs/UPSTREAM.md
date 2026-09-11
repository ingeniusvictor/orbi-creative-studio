# Upstream Reference

This repository is intended to derive from:

- Repository: https://github.com/Anil-matcha/Open-Generative-AI
- Owner: Anil-matcha
- Default branch: `main`
- Baseline commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- Commit message: `Revise video content in README.md`
- Baseline captured: 2026-09-11
- Upstream license: MIT
- Observed root package version: `2.0.0`

## Baseline architecture observed

The upstream root package declares:

- Next.js 15
- React 19
- Electron 33
- Vite 5
- npm workspaces
- local image inference through `sd.cpp`
- BYO Wan2GP server integration for video / large-model inference
- MuAPI-backed cloud model access

## Sync policy

ORBI-specific development should occur only after the original source baseline has been imported and verified.

Future upstream updates should be reviewed intentionally rather than merged blindly, because ORBI may diverge in provider routing, local inference, branding, privacy, and compute orchestration.
