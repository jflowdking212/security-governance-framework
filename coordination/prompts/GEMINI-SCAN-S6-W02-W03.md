# GEMINI ADDENDUM: SCAN-S6 + W-02/W-03 ADVERSARIAL AUDIT

Continue from your verified A2-02/A2-07 commit `6d33dfa4cc855b39a03016ae1661a4e7cf48e877`. Do not restart completed work.

## 1. SCAN-S6

Claude found that the scanner skips a worktree leaf when it is a symlink, even if the Git index records that path as a regular file.

Reproduce this exact case. Compare index mode using `git ls-files -s` with the actual worktree entry. Reject/fail closed when index mode is 100644/100755 but the worktree entry is a symlink. Preserve valid indexed symlink entries. Add tests for both cases.

Apply consistently to standalone scanner, first-party workflow copies, consumer workflow copies, generated/expected guards and validators. Add mutation tests so parity cannot silently weaken.

## 2. W-02/W-03 adversarial re-attack

Review first-party and consumer workflows for:
- Permission escalation and job-level write permissions.
- Untrusted expression injection, including helper-wrapped expressions.
- Trigger and filter manipulation.
- Shell execution and error-suppression bypasses.
- Job/step conditions, timeouts, extra steps and uses+run combinations.
- Environment and GitHub context injection.
- Mutable/substituted action references.
- Scanner configuration/ignore overrides and embedded-copy drift.
- Consumer-template/validator parity.

Reproduce each bypass before correcting it. Do not claim prior tests cover a scenario unless you execute it.

## 3. Verification and boundary

Run focused tests, full `npm test`, all generators, all validators, zero-drift check, Linux VPS verification, Windows verification and hosted validation/security scans on the exact final SHA.

Do not touch checksum/A2-03/W-04 files, Claude's A2-11/A2-12 files, or the shared handoff ledger. Work in your own branch and return exact SHA, diffs, reproduction commands, raw outputs, test totals, VPS details, hosted run IDs and unresolved issues.

No merge, signing, tag, release or deployment.