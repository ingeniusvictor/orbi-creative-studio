# ADR-001 — Local-First, Cost-Visible Compute

Status: **Proposed during Phase 0**  
Date: 2026-09-12

## Context

The upstream project combines:

- desktop-local image inference (`sd.cpp`),
- user-owned remote inference (Wan2GP), and
- a large cloud model catalog primarily routed through MuAPI.

ORBI Creative Studio is intended to preserve access to high-quality cloud models while minimizing mandatory recurring cost and making user-owned compute useful.

## Decision

ORBI will adopt a **local-first, cost-visible** generation policy.

For any requested generation, the Compute Router should prefer execution in this order when capabilities and user intent allow:

1. same-device local compute;
2. user-owned LAN/edge compute;
3. user-configured direct cloud provider;
4. broker/aggregator cloud provider.

The router may override this order when the user explicitly selects a provider/model or when a required capability exists only on another tier.

## Paid execution rule

A paid cloud invocation should expose, when technically available:

- provider
- model
- estimated credit/currency cost
- media leaving the user's devices
- expected execution boundary

before generation begins.

Autonomous workflows may operate within an explicit user-defined budget, but absence of a budget must not be interpreted as unlimited spending authorization.

## Privacy rule

Provider adapters must identify whether execution occurs:

- on device,
- on user-owned network compute,
- on user-owned remote compute,
- or on third-party infrastructure.

## Architecture consequence

Studio components should call a provider-neutral ORBI Generation API rather than instantiate MuAPI/Wan2GP/cloud logic directly.

```text
Studio
  -> ORBI Generation API
      -> Compute Router
          -> Local adapter
          -> Edge adapter
          -> Direct-cloud adapter
          -> Broker adapter
```

## Why this decision

This approach:

- preserves the value of the upstream UI and model catalog;
- allows zero-API-cost workflows where hardware permits;
- supports ORBI Edge Mesh later;
- prevents a single broker from becoming a permanent architectural dependency;
- makes generation cost and data boundaries understandable.

## Consequences

Positive:

- lower vendor lock-in
- controllable operating cost
- reusable edge architecture
- easier privacy controls
- cloud models remain available

Tradeoffs:

- provider capability normalization is additional engineering work
- cost estimation may be approximate or unavailable for some providers
- local models require storage/hardware management
- edge routing adds authentication and scheduling complexity

## Deferred decisions

This ADR does not choose:

- the final provider interface schema;
- the Edge Mesh transport protocol;
- a public billing system;
- a specific local video model;
- the final Android inference backend.

Those decisions require runtime evidence after Phase 0.