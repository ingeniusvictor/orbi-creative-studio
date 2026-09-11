# ORBI Creative Studio — Runtime Configuration Inventory

Baseline: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

## Environment variables observed

### `MUAPI_KEY`

Observed in:

- `scripts/test_minimax_provider.js`

Purpose:

- optional live smoke testing against MuAPI

The main interactive application does not rely on this environment variable for normal user configuration; it obtains the MuAPI key from browser-accessible storage.

### `UPLOAD_PROXY_ALLOWED_HOSTS`

Observed in:

- `src/lib/uploadProxyTarget.js`

Purpose:

- comma-separated allowlist of additional upload-proxy target hostnames

The upload proxy otherwise permits recognized Amazon S3 host forms and rejects unsafe/local targets.

### `OPEN_GENERATIVE_AI_LOCAL_AI_DIR`

Observed in:

- `electron/lib/localInferencePaths.js`

Purpose:

- overrides the base directory used for local AI binaries, weights, and temporary files

Derived folders:

- `bin/`
- `models/`
- `tmp/`

This is useful for ORBI because multi-GB weights can be moved to a dedicated disk.

### `NODE_ENV`

Observed through deployment/build configuration.

Docker production configuration sets:

`NODE_ENV=production`

## Browser/application storage keys observed

These are not environment variables but affect persistence/security.

### `muapi_key`

Stores the MuAPI API key in `localStorage`.

Also mirrored into a `muapi_key` browser cookie for agent-related Next.js server routes.

### `muapi_pending_jobs`

Stores pending generation job metadata.

### `muapi_uploads`

Stores upload history.

### `muapi_history`

Stores generation history.

### `open_gen_notifications_v1`

Observed in the standalone shell for notification state.

## Electron local configuration

Wan2GP configuration is written to:

`<Electron userData>/local-ai/wan2gp.json`

It stores the configured Wan2GP server URL.

## Configuration design recommendation for ORBI

Do not continue adding unrelated storage keys directly across UI components.

After Phase 0, introduce a typed configuration boundary for:

- provider credentials
- provider endpoints
- local-model paths
- node trust
- privacy policy
- routing preferences
- generation history
- job persistence

Secrets and non-secret preferences should be separated.

## Missing baseline artifact

No root `.env.example` exists at the pinned commit.

Before a public ORBI developer release, create an ORBI-specific environment template that documents only variables actually supported by ORBI.
