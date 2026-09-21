# AgentShield P2 baseline audit — ORBI Creative Studio

Status: CLASSIFIED / NON-ENFORCING  
Workflow run: 35555473356  
Artifact: `ecc-agentshield-report-35555473356`  
Artifact digest: `sha256:4726b177c9a247ceecfc685bce965fa73f3b0ff82ec927b610d1c9dc47cb0078`

## Execution result

The pinned AgentShield action executed successfully and the evidence pack verified successfully.

Observed scanner summary:

- score: 80/100;
- grade: B;
- findings: 1161;
- critical: 1161;
- high/medium/low/info: 0;
- supply-chain status: clean;
- packages analyzed: 1042;
- risky packages: 0;
- package provenance: 1033 pinned, 9 unpinned;
- evidence pack verification: PASSED;
- evidence-pack digest: `sha256:c2878443b1afb932058a0dea3874a9347cf0633b8a8bbd6c3dbd48bb55f805a1`.

## Finding classification

The raw report was inspected rather than accepting the severity count at face value.

All 1161 findings share:

- category: `secrets`;
- severity: `critical`;
- title: `Hardcoded Azure storage account key`;
- file: `package-lock.json`.

The first reported value at line 44 is inside the normal npm lockfile field:

```json
"integrity": "sha512-UrcABB+4bUrFABwbluTIBErXwvbsU/V7TZWfmbgJfbkwiBuziS9gxdODUyuiecfdGQ85jglMW6juS3+z5TsKLw=="
```

The next reported value follows the same structure for another npm dependency.

These are npm Subresource Integrity SHA-512 values, not Azure account keys.

The report contains 1161 unique lockfile lines and 1090 unique evidence strings, all classified under the same Azure-key detector.

## ORBI conclusion

For this repository/release, the root-path secret detector produces a high-volume false-positive class on npm integrity hashes.

Therefore:

1. the raw `1161 critical` count MUST NOT be interpreted as 1161 real leaked secrets;
2. the score/grade MUST NOT be used as an enforcement threshold yet;
3. `package-lock.json` MUST NOT be rewritten or redacted in response to these findings;
4. AgentShield remains report-only;
5. the baseline artifact should be retained so future changes can be compared by stable fingerprint instead of raw count;
6. any future enforcement requires either upstream false-positive remediation or an ORBI policy/baseline that separates accepted lockfile findings from new runtime-relevant findings.

## Scanner coverage observation

The report recorded zero matched harness adapters at this stage. That is consistent with the canonical repository not yet having active root `AGENTS.md`, `CLAUDE.md`, `.claude/`, or `.mcp.json` surfaces when the pilot started.

This makes P2 primarily a scanner/supply-chain baseline, not yet a meaningful agent-configuration enforcement baseline.

## Workflow defect found and corrected

The first workflow run used Markdown backticks inside double-quoted Bash `echo` statements. Bash interpreted them as command substitutions, producing harmless `command not found` messages while the workflow still completed successfully.

The workflow was corrected to emit plain summary values without shell-interpreted backticks.

No product/runtime source file was modified by either issue.
