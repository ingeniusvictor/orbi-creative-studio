# ORBI Creative Studio — Provider and Model Surface Map

Baseline: `Anil-matcha/Open-Generative-AI@871c1d4ef4e184d7b6b5117147d863d30b656cbb`

## Cloud catalog size

Static parsing of `packages/studio/src/models.js` found:

- 537 model-entry occurrences
- 532 unique model IDs
- 455 endpoint occurrences
- 444 unique endpoint strings

Category counts:

| Catalog | Entries |
|---|---:|
| Text-to-image | 78 |
| Text-to-video | 105 |
| Image-to-image | 76 |
| Image-to-video | 173 |
| Video-to-video | 67 |
| Lip sync | 15 |
| Recast | 3 |
| Motion control | 2 |
| Audio | 18 |
| **Total** | **537** |

Five IDs intentionally/structurally occur in more than one capability catalog:

- `flux-pulid` — T2I + I2I
- `flux-redux` — T2I + I2I
- `qwen-text-to-image-2512` — T2I + I2I
- `infinitetalk-video-to-video` — V2V + lip sync
- `volcengine-video-to-video-lip-sync` — V2V + lip sync

This supports the upstream "400+ models" claim at the catalog level, but it must not be interpreted as 500+ locally installed models.

## Local catalog

The local front-end catalog currently exposes 12 entries.

### sd.cpp — same-machine inference

6 image entries:

- Z-Image Turbo
- Z-Image Base
- DreamShaper 8
- Realistic Vision v5.1
- Anything v5
- SDXL Base 1.0

### Wan2GP — user-operated server

6 entries:

- FLUX.1 Dev
- Qwen Image
- Wan 2.2 Text-to-Video
- Wan 2.2 Image-to-Video
- Hunyuan Video
- LTX Video

Wan2GP is called "local" in the UI sense, but architecturally it is a network provider: the Electron client sends HTTP requests to a user-configured Gradio server.

## Current architecture

```
                        Open Generative AI UI
                                |
          +---------------------+----------------------+
          |                     |                      |
       MuAPI                  sd.cpp                 Wan2GP
       cloud             local same-machine       HTTP Gradio server
          |                     |                      |
   ~532 catalog IDs       6 image entries          6 curated entries
```

## ORBI opportunity

The upstream already exposes a natural seam for a provider abstraction.

Proposed later architecture:

```
                         ORBI Creative Studio
                                |
                        Capability Registry
                                |
                          Compute Router
          +---------------------+-----------------------+------------------+
          |                     |                       |                  |
       sd.cpp                Wan2GP                ORBI Edge Mesh      Cloud
    same machine           GPU/LAN node          Android/PC nodes     optional
```

Routing inputs should eventually include:

- capability required
- model availability
- local hardware readiness
- RAM/VRAM budget
- latency expectation
- privacy level
- estimated monetary cost
- network state
- provider health
- user preference

## Important distinction

"Model in catalog" can mean one of several things:

1. a cloud API endpoint exposed through MuAPI,
2. a local weight directly executed by sd.cpp,
3. a model expected to exist on a Wan2GP server,
4. a capability alias sharing an underlying model/endpoint.

ORBI should represent those explicitly instead of presenting every entry as the same kind of model.

## Phase 1 recommended data model

Each provider/model capability should eventually expose fields similar to:

```json
{
  "id": "model-id",
  "provider": "sdcpp|wan2gp|orbi-edge|cloud",
  "capabilities": ["t2i"],
  "execution": "local|lan|cloud",
  "cost": "free-compute|metered",
  "privacy": "device|trusted-lan|third-party",
  "hardware": {},
  "license": {},
  "health": {},
  "provenance": {}
}
```

Do not implement this abstraction until Phase 0 baseline build certification is complete.
