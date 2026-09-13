# INFRA-03 — Self-hosted Runner Fallback

## Purpose

Provide a no-cost fallback for GitHub Actions runner allocation while GitHub-hosted runner usage is blocked.

GitHub documents that self-hosted runners do not consume GitHub-hosted Actions minutes. The machine owner remains responsible for the machine and its security.

## Security posture

This fallback is intentionally manual and minimal.

- workflow trigger: `workflow_dispatch` only
- no `pull_request` trigger
- no `push` trigger
- no repository checkout
- no npm install
- no arbitrary repository scripts
- no secrets
- no provider credentials
- no generation execution

The first workflow only proves that GitHub can allocate the registered self-hosted machine.

## Recommended runner

Repository-level Windows x64 runner with labels:

- `self-hosted`
- `windows`
- `x64`
- `orbi-cert`

## GitHub UI registration

1. Open repository Settings.
2. Open Actions → Runners.
3. Choose New self-hosted runner.
4. Select Windows and x64.
5. Follow the exact commands GitHub generates.
6. Use `C:\actions-runner` as the runner directory.
7. Add custom label `orbi-cert`.

GitHub generates a time-limited registration token. Never commit or paste that token into the repository.

## Windows service

If the runner will be used repeatedly, GitHub supports installing the Windows runner as a service. Registration as a service requires an elevated shell.

## First validation

After the runner reports Online:

1. Open Actions.
2. Select `ORBI Self-hosted Runner Probe INFRA-03`.
3. Run workflow manually on the INFRA-03 branch.
4. Require the sentinel `ORBI_INFRA_03_SELF_HOSTED_ALLOCATED`.

## Do not use for arbitrary PR code

A self-hosted runner has access to the host machine. Do not attach this runner to workflows triggered automatically by untrusted PRs or forks.

Future full certification on self-hosted hardware must be a separately reviewed manual workflow with explicit checkout restrictions and no long-lived secrets.

## Current boundary

INFRA-03 is a fallback probe only. It does not replace the required Linux/macOS/Windows hosted certification matrix and it does not authorize any Compute Router merge or cutover.