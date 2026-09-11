# ORBI Creative Studio — Provider Secret Storage Design

Status: architecture plan; no credential migration has been applied yet.

## Baseline problem

The pinned upstream treats the MuAPI credential as a UI-global browser value.

Observed `muapi_key` usage spans at least 18 indexed locations and crosses several boundaries:

- renderer `localStorage`
- JavaScript-readable browser cookie
- Next.js server components
- API proxy routes
- Studio components
- Agent client components
- background/pending-job polling

This makes one credential representation serve desktop UI, hosted web and server rendering at the same time.

## Current storage paths

### Browser localStorage

Written by:

- `src/components/AuthModal.js`
- `src/components/SettingsModal.js`

Read directly by multiple Studio components and `src/lib/muapi.js`.

### JavaScript-readable cookie

`components/StandaloneShell.js` mirrors the stored key into:

`muapi_key=<value>; path=/; max-age=31536000; SameSite=Lax`

The cookie is intentionally JavaScript-readable because client code also reads it.

Server components under `app/agents/**` then use that cookie for provider-authenticated requests.

## Why ORBI should change this

The current design creates several risks:

- XSS can access a long-lived provider credential.
- UI components know storage details.
- provider-specific secret names leak into domain/UI logic.
- desktop and hosted-web security requirements are conflated.
- future providers would multiply direct storage reads/writes.
- ORBI Edge nodes should never inherit browser-storage assumptions.

## Target abstraction

Provider adapters should request credentials through a narrow interface.

Conceptually:

```ts
interface ProviderSecretStore {
  get(providerId: string, secretName: string): Promise<string | null>;
  set(providerId: string, secretName: string, value: string): Promise<void>;
  delete(providerId: string, secretName: string): Promise<void>;
  has(providerId: string, secretName: string): Promise<boolean>;
}
```

UI code should ask a provider/session service whether credentials are available; it should not read `localStorage` directly.

## Desktop strategy

For Electron:

1. renderer never receives arbitrary filesystem/OS secret access;
2. preload exposes narrow IPC methods;
3. main process owns secret persistence;
4. prefer OS-backed credential storage where available;
5. provider adapters request credentials through the main-process boundary.

Candidate backends can be evaluated later, but the API should not depend on a specific keychain package.

Fallback policy:

- if secure OS storage is unavailable, require explicit user consent for a less-secure local encrypted/file-backed mode;
- never silently fall back to plaintext browser storage.

## Hosted web strategy

For hosted Next.js:

- provider credentials should preferably remain server-side;
- use an ORBI session identity rather than exposing third-party API keys to every browser component;
- provider proxy routes can attach credentials server-side;
- cookies used for session identity should be `HttpOnly`, `Secure` in production, and scoped appropriately;
- do not use a provider API key itself as the session cookie.

This implies a larger hosted-web authentication/session design and should not be smuggled into a small refactor.

## Transitional migration

A safe migration can happen in stages.

### Stage S1 — access abstraction

Introduce:

- `ProviderCredentialService`
- compatibility implementation that still reads the current `muapi_key`

Goal: remove direct storage reads from components without changing user behavior.

### Stage S2 — centralize writes

Auth/Settings write through the service.

No component writes `localStorage` directly.

### Stage S3 — desktop secure store

Electron switches the service implementation to IPC/main-process secret storage.

The compatibility localStorage value can be migrated once, then deleted after successful secure persistence.

### Stage S4 — hosted web server-side credentials/session

Hosted mode moves away from browser-held provider keys.

This is a separate migration with explicit session/security testing.

## Component migration inventory

Direct renderer reads currently observed in:

- `src/lib/muapi.js`
- `src/components/LipSyncStudio.js`
- `src/components/VideoStudio.js`
- `src/components/UploadPicker.js`
- `src/components/ImageStudio.js`
- `src/components/CinemaStudio.js`
- `src/components/SettingsModal.js`

Direct writes observed in:

- `src/components/AuthModal.js`
- `src/components/SettingsModal.js`

Agent-side browser fallback reads appear in:

- `AgentCreateClient.js`
- `AgentEditClient.js`
- `AgentChatClient.js`

Server reads appear under:

- `app/agents/create/page.js`
- `app/agents/edit/[id]/page.js`
- `app/agents/[agent_id]/page.js`
- `app/agents/[agent_id]/[conversation_id]/page.js`

## Logging rule

Provider secrets must never be:

- logged,
- included in routing diagnostics,
- stored in generation history,
- copied into error telemetry,
- serialized into ORBI Edge job payloads unless the destination provider explicitly requires that credential and the trust boundary is approved.

## Compute Router relationship

The Compute Router should receive a provider readiness state such as:

```json
{
  "provider": "muapi",
  "credentials": "available"
}
```

It should not receive the secret value.

The selected provider adapter resolves its own credential only when executing the job.

## Tests required

Before migration completion:

- secret service get/set/delete
- renderer cannot access main-process secret backend directly
- no direct `localStorage.getItem('muapi_key')` remains in production Studio components
- no direct `localStorage.setItem('muapi_key')` remains
- hosted cookies do not contain raw provider keys
- logs/errors redact known secret patterns
- migration from legacy storage is one-time and idempotent

## Rule

Do not delete legacy credential storage until every current workflow has a tested replacement.

Security improvement must not silently break pending-job polling, Agent Studio or hosted server routes.
