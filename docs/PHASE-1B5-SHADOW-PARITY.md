# ORBI Creative Studio — Compute Router Shadow Parity P1B.5

Status: preparation only. No Studio execution path is changed.

## Purpose

Before the Compute Router can control a real generation, ORBI needs a deterministic way to ask:

> “For the exact model the current Studio would execute today, what would the router decide from the same readiness evidence?”

`src/lib/computeRouter/studioShadowRouting.mjs` answers that question without executing anything.

## Legacy ownership mapping

Current model catalogs are treated as the source of truth for the existing execution path:

- sd.cpp local models → `sdcpp-device`
- Wan2GP models → `wan2gp-lan`
- MuAPI catalog models → `muapi-cloud`

Every exact model/capability mapping must have one deterministic owner. Ambiguity fails closed.

## Studio-shaped input

The adapter accepts the field shapes the current Studio already uses, including:

- `model` / `modelId`
- `prompt`
- `aspect_ratio` / `aspectRatio`
- `resolution`
- `duration` / `durationSeconds`
- optional explicit capability and input references

It converts them into the existing `GenerationRequest` contract with:

- exact `modelPreference`;
- `cloud-ok` privacy baseline;
- `metered-ok` cost baseline;
- interactive latency;
- `allowFallback: false`.

The exact model preference is the primary stop rule: this stage measures parity; it does not silently substitute a different model/provider.

## Result

`shadowRouteStudioRequest()` returns descriptive evidence only:

- `executed: false`
- legacy provider ID
- router-selected provider ID, if any
- parity = `match`, `divergence`, or `no-route`
- compact candidate/rejection reasons

There is no IPC, provider call, network request, generation call, upload, secret read, or automatic fallback in this module.

## Important MuAPI gate

P1B.4 deliberately does not invent MuAPI transport health. Therefore a renderer snapshot currently composes MuAPI as:

- credentials: available/missing/unknown from secure storage;
- health: `unknown` unless a real transport-health observation is supplied elsewhere.

Because the router rejects providers whose health is not `ready` or `degraded`, shadow routing will report `no-route` for MuAPI until a real, narrow health probe is designed and certified.

That is intentional. It prevents the future router from promoting cloud execution based solely on the presence of an API key.

## Next controlled step

After CI is restored and P1B.3/P1B.4/P1B.5 are certified, the Studio can be instrumented to record shadow parity beside the existing execution decision while still executing the legacy path.

Only after repeatable parity evidence should authority move from the legacy branches to the Compute Router.
