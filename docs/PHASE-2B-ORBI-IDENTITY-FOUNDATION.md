# Phase 2B — ORBI Identity Foundation

Starting canonical: `1c77d101dfbce481c9443c75a63cfea02e297e08`.

## Goal

Make the active ORBI Creative Studio desktop and web shells identify themselves as **ORBI Creative Studio** without breaking existing local models, credentials, user data, provider integrations or upstream attribution.

## Visible identity introduced

A canonical identity record now lives at `shared/productIdentity.json` and defines:

- `ORBI Creative Studio` as the product name;
- `ORBI Studio` as the compact name;
- `ORBI` / `CREATIVE STUDIO` as the header wordmark labels;
- the ORBI repository and product description;
- `Open Generative AI` as the upstream project reference.

The identity is applied to:

- Electron window title and startup error dialogs;
- the Electron/Vite desktop header;
- Vite document title and metadata;
- Next root metadata;
- Studio route metadata;
- Workflow route metadata;
- Agent route metadata;
- localized Chinese Studio route metadata;
- root package description and homepage.

## Storage and installer compatibility lock

This pass deliberately **does not** rename the following package/build identifiers:

- npm package `name = open-generative-ai`;
- Electron Builder `productName = Open Generative AI`;
- Electron Builder `appId = ai.generative.open`.

Why: the current desktop implementation stores important state beneath Electron's `app.getPath('userData')`, including local-AI runtime/model paths and encrypted provider credentials. Changing application/package identity before proving a migration path could cause an existing installation to start using a different data directory and make previously downloaded models or stored credentials appear missing.

The Phase 2B gate therefore freezes those legacy identifiers while visible branding changes independently.

A later installer/storage migration may change them only when it can demonstrate:

1. deterministic discovery of the legacy user-data location;
2. preservation or safe migration of local models/runtime state;
3. preservation or explicit recovery handling for encrypted credentials;
4. rollback/fallback behavior;
5. upgrade testing on Windows first, then other packaged targets.

## Upstream attribution boundary

This rebrand does not rename third-party provider APIs, model names, external repositories, package dependencies or upstream technical identifiers required for compatibility.

The repository `LICENSE` remains intact. The canonical identity record explicitly retains `Open Generative AI` as the upstream project reference. A future README reframing must preserve upstream attribution and licensing while making ORBI Creative Studio the top-level product narrative.

## Visual header behavior

The desktop header now uses a lightweight ORBI orbital mark composed from UI primitives plus a two-line `ORBI / CREATIVE STUDIO` wordmark. It does not introduce a new binary brand asset in this phase. Clicking the identity returns to Image Studio.

## Non-goals

Phase 2B does not:

- change provider routing;
- change MuAPI/Wan2GP/sd.cpp identifiers;
- change local-AI storage paths;
- change Electron Builder app identity;
- redesign navigation semantics;
- integrate desktop Workflows/Agents;
- productize Scene3D;
- add a standalone Audio Studio.

Those remain later Phase 2 product outcomes.

## Gate

`tests/orbiProductIdentity.test.js` enforces both sides of this change:

- active visible surfaces must identify as ORBI Creative Studio;
- storage/installer-sensitive legacy identifiers must remain unchanged until a migration gate exists.

The repository integrated PR gate must also remain GREEN before merge.
