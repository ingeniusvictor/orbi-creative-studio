# ORBI Creative Studio — Git Integration Strategy

Status: design decision for post-Phase-0 integration.

## Current repository history

The repository intentionally contains two history roots.

### ORBI documentation root

Branches such as:

- `main`
- `feature/phase-0-certification`

originate from the initial ORBI repository creation.

They contain ORBI documentation/certification metadata and **do not contain the upstream application tree**.

### Upstream application root

Branches such as:

- `upstream-baseline`
- `security/batch-a-lock-safe`
- certification branches derived from them

originate from the original `Anil-matcha/Open-Generative-AI` Git history.

This preserves upstream provenance exactly.

## Important consequence

The two roots are unrelated Git histories.

ORBI must not solve this by:

- force-pushing `main`,
- squashing away the upstream history,
- copying the source tree without history,
- rebasing `upstream-baseline`,
- pretending `main` and upstream share an ancestor.

## Recommended integration model

Create an ORBI-owned foundation branch **from the best certified upstream-derived branch**.

Example after security selection:

```
upstream-baseline
       |
security/batch-a-lock-safe
       |
(optional validated Batch B)
       |
integration/orbi-foundation
```

Then merge the ORBI documentation history into that foundation **once**, explicitly allowing unrelated histories.

Conceptually:

```bash
git checkout integration/orbi-foundation
git merge feature/phase-0-certification --allow-unrelated-histories
```

Resolve only intentional file collisions such as:

- root `README.md`
- root `LICENSE`

All source/application files should come from the upstream-derived side.

All ORBI audit/certification docs should come from the ORBI documentation side.

## Root README collision policy

The final ORBI README should be newly authored for ORBI and include:

- ORBI Creative Studio identity
- current status
- upstream attribution
- exact original baseline
- build/security status
- local/cloud architecture
- links to upstream/third-party notices

Do not blindly choose either pre-merge README.

## LICENSE collision policy

The MIT notice inherited from upstream must remain preserved.

ORBI may add its own copyright notices for new ORBI-authored code where legally appropriate, but must not replace or erase upstream notices.

Recommended later structure:

- `LICENSE` — applicable project licensing text
- `THIRD_PARTY_NOTICES.md` — upstream/submodule/model notices
- provenance docs — source/revision/license details

## Main branch migration

Do **not** switch `main` until the integration foundation passes:

- tests
- builds
- production dependency audit
- Docker smoke
- Windows package/install/launch
- Linux package/launch
- source/provenance review

Once the foundation is certified, there are two reasonable options:

### Preferred

Merge the foundation into `main` with unrelated histories explicitly reconciled and preserve both roots.

### Alternative

Change the repository default branch to the certified integration branch, then retire the original documentation-only `main` after preserving it as a tag/branch.

The preferred approach preserves continuity and avoids deleting history.

## Upstream sync after integration

Never move `upstream-baseline`.

Create a remote `upstream` in developer clones and review future upstream changes against the integration branch.

A future sync should be:

1. fetch upstream,
2. record new upstream commit,
3. compare against certified baseline,
4. audit changed providers/dependencies/models,
5. merge/cherry-pick intentionally,
6. re-run certification.

## Security branch selection

At the time this document was written:

- immutable baseline exists,
- Batch A is validated at tests/build level and reduces production audit risk,
- later security experiments are still being evaluated.

Therefore the exact parent of `integration/orbi-foundation` should be selected only after the current security experiments finish.

## Rule

The integration operation is a provenance event.

It should receive its own PR/evidence and must never be performed silently.
