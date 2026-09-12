# Phase 0 Audit — Cloud / Local Execution Map

Baseline: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

## Classification rule

A model appearing in the UI or model registry does **not** imply local execution or zero cost. The execution path must be classified separately.

## A. Local on the same desktop: sd.cpp

The upstream includes a bundled `stable-diffusion.cpp` integration for image generation.

Curated local catalog observed at the pinned baseline:

| Model | Approx. weights | Auxiliary files | Default output/steps |
|---|---:|---:|---|
| Z-Image Turbo | 2.5 GB | Qwen3-4B encoder 2.4 GB + FLUX VAE 0.33 GB | 1024px / 8 steps |
| Z-Image Base | 3.5 GB | same auxiliaries | 1024px / 50 steps |
| DreamShaper 8 | 2.1 GB | none listed | 512px / 20 steps |
| Realistic Vision v5.1 | 2.1 GB | none listed | 512x768 / 25 steps |
| Anything v5 | 2.1 GB | none listed | 512x768 / 20 steps |
| SDXL Base 1.0 | 6.9 GB | none listed | 1024px / 30 steps |

These downloads are sourced from public Hugging Face URLs in `electron/lib/modelCatalog.js` and do not require a MuAPI key.

## B. User-owned compute over LAN/HTTP: Wan2GP

Wan2GP is treated as a remote local-compute provider: the ORBI/Open Generative AI UI may be on one device while inference runs on a user-owned GPU server.

Catalog entries observed:

- Flux.1 Dev
- Qwen Image
- Wan 2.2 text-to-video
- Wan 2.2 image-to-video
- Hunyuan Video
- LTX Video

The upstream application does not bundle Wan2GP Python or model weights. It stores the configured server URL and sends requests to the user's Gradio server.

This is the closest existing architectural pattern to the future ORBI Edge Mesh concept.

## C. Cloud through MuAPI

MuAPI is the dominant cloud path at the pinned baseline.

Observed behaviors:

- API host: `https://api.muapi.ai`
- authentication header: `x-api-key`
- task pattern: submit -> obtain request ID -> poll for result
- uploads can be sent to MuAPI-hosted upload endpoints
- Vite development proxy routes `/api` to MuAPI
- Next.js middleware/routes proxy multiple API surfaces to MuAPI

Cloud model registry names include commercial/provider families such as Kling, Veo, Sora, Seedance, MiniMax, PixVerse, Vidu, xAI and others. Their presence in the registry must not be represented as local availability or zero-cost inference.

## D. Proposed ORBI execution classes

ORBI should normalize all generation targets into explicit execution classes:

1. `LOCAL_DEVICE`
   - same machine as UI
   - example: sd.cpp
   - API generation cost: zero

2. `LOCAL_NETWORK`
   - user-owned compute reachable through LAN/VPN
   - example: Wan2GP
   - API generation cost: zero, hardware/electricity cost applies

3. `EDGE_MESH`
   - future ORBI-managed/user-owned nodes
   - phone, PC, mini-PC or GPU worker selected by capability

4. `CLOUD_BYO`
   - user's own direct provider credentials
   - provider billing applies

5. `CLOUD_BROKER`
   - aggregator/broker such as MuAPI
   - broker credits/billing apply

## E. Required provider metadata for ORBI

Every provider/model adapter should eventually expose at minimum:

```text
provider_id
model_id
execution_class
media_type
capabilities
required_inputs
supported_aspect_ratios
estimated_memory
estimated_cost
cost_currency_or_credits
requires_network
requires_secret
supports_cancel
supports_progress
privacy_boundary
```

This will allow the Compute Router to make transparent choices instead of hiding whether a request is local or paid.

## F. Cost-control policy recommendation

Before any paid generation, ORBI should be able to show:

- selected provider/model
- local vs cloud status
- estimated credits/cost when available
- destination of uploaded media
- explicit user approval for paid execution

Future autonomous workflows may receive a user-defined budget, but the default should remain local-first and cost-visible.

## G. Phase 0 conclusion

The upstream already provides enough separation to support a local-first ORBI architecture. The priority after baseline certification should be **provider normalization and routing**, not adding more model names to the UI.