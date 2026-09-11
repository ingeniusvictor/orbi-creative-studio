# ORBI Creative Studio — Phase 0 Linux Desktop Launch Certification

Certification date: 2026-09-11

Baseline:

- commit: `871c1d4ef4e184d7b6b5117147d863d30b656cbb`
- strengthened certification run: `34653781361`

## Result

**PASS**

The unpacked Linux x64 Electron application was built and launched under a virtual X display.

The strengthened check did not rely only on the `xvfb-run` wrapper. After a 12-second stability window it verified live `open-generative-ai` processes.

Evidence included:

- main Electron process
- zygote processes
- renderer process
- network-service process
- GPU-process attempt

Marker:

`DESKTOP_CHILD_PROCESS_SMOKE_PASS`

## Environment limitations

The headless GitHub runner emitted expected desktop-environment warnings/errors including:

- missing/invalid DBus server address
- GPU process initialization/restart behavior under virtual display

These did not terminate the application during the stability window.

The smoke was intentionally run with:

- `xvfb-run`
- `--no-sandbox`
- CI/headless graphics environment

Therefore this is a launch/runtime smoke, not a replacement for an interactive Linux desktop acceptance test.

## What this certifies

- unpacked Electron app can start,
- packaged resources are loadable enough to sustain renderer/main processes,
- process tree survives the initial startup window.

## What remains

- interactive UI inspection on a real Linux desktop,
- GPU-accelerated local inference,
- sandbox/AppArmor behavior on target distro,
- AppImage/DEB install/desktop-launch integration on multiple distributions.

Packaging itself is certified separately in `docs/PHASE-0-DESKTOP-PACKAGING.md`.
