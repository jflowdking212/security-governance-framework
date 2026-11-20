# Gemini Implementation Prompt: USS A2-02 and A2-07

You are the implementation engineer for two bounded findings in the Universal Security Standard repository. This is an implementation assignment, not an audit-only assignment.

## Repository and branch

- Repository: `jflowdking212/security-governance-framework`
- PR: #9
- Working branch: `fix/uss-final-audit-remediation`
- PR base: `integration/uss-pr3-pr8-hardening`
- Code baseline before these prompt documents were added: `13e17461b1dd77cfee82bdc9041e0ad8223a4548`
- First action: fetch the live branch head and inspect the complete diff from the PR base. Prompt-document commits may have advanced HEAD without changing implementation code. Work from the latest remote HEAD, not from an old local checkout.

## Your ownership

You own only:

- **A2-02:** workflow security AST/schema validation and adversarial mutation tests.
- **A2-07:** scanner coverage, scanner configuration assurance and provenance evidence.

Your permitted implementation scope is:

- `.github/workflows/uss-validation.yml`
- `.github/workflows/security-scans.yml`
- `templates/ci/consumer-security-scans.yml`
- `tests/workflow-security.test.mjs`
- A narrowly necessary workflow-security validator helper, if required.

Do not edit checksum files, evidence-validator files, stack profiles, README release-status corrections, or the shared handoff ledger. In particular, do not modify:

- `tools/checksums.mjs`
- `tests/checksums.test.mjs`
- `tools/validate-evidence.mjs`
- `tests/evidence.test.mjs`
- any file under `stacks/`
- `coordination/agent-handoff.md`

If you discover a cross-workstream dependency, report it to ChatGPT with the exact path and evidence. Do not fix it outside your ownership.

## A2-02: workflow security guard

Inspect the existing YAML parser, validator and tests first. Build on the existing implementation rather than replacing it wholesale. Validation must inspect parsed YAML structure/AST, not rely only on fragile regular expressions or substring checks.

Add negative mutation tests for every attack below. Each test must mutate an isolated copy/fixture and prove the validator rejects it. Also prove the current legitimate workflows and consumer template pass.

1. **Permissions**
   - Reject a missing workflow-level permissions declaration.
   - Reject workflow-level `write` and `write-all` permissions.
   - Inspect job-level permissions, not just workflow-level permissions.
   - Reject job-level `write` / `write-all` except narrowly documented, least-privilege permissions required by the specific scanner job, such as CodeQL's `security-events: write`.
   - Reject a permission exception if it is granted to unrelated jobs or broadened beyond the minimum required.

2. **Untrusted expression interpolation**
   - Reject direct untrusted GitHub context interpolation inside `run:`, including `github.event`, `github.head_ref`, `github.actor`, `github.ref_name`, and equivalent event/input variants.
   - Cover dot notation, bracket notation and nested event payload paths.
   - Do not only check the literal string `github.event`.
   - Where data must be passed, use a narrowly scoped `env:` value and safely quoted shell expansion. Verify that the unsafe expression has not simply moved into another executable field.

3. **Triggers**
   - Use an explicit approved trigger allow-list appropriate to each workflow. The currently expected trigger families are `push`, `pull_request`, `schedule` and `workflow_dispatch`; do not automatically allow every trigger.
   - Reject `pull_request_target`, `workflow_run`, `issue_comment`, `pull_request_review_comment` and any unapproved trigger.
   - Reject unexpected trigger combinations or filters that silently exclude required branches/events.

4. **Disabled or bypassed jobs/steps**
   - Reject `if: false` and equivalent constant-false conditions.
   - Reject conditions or dependencies that disable mandatory validation/scanner jobs or steps on relevant events.
   - Assert required steps exist and are in the required order.
   - Reject deletion, reordering or replacement of required steps, including attempts to replace real evidence validation with `node tools/validate-evidence.mjs --help`.
   - Test that required jobs cannot be made optional through `needs`, `if`, matrix filters or similar YAML changes.

5. **Error suppression and failure masking**
   - Cover `|| true`, `|| exit 0`, `|| echo ignored`, `set +e`, semicolon-success patterns, and equivalent suppression.
   - Reject `continue-on-error: true` on security jobs or mandatory security steps.
   - Ensure scanner and validation failures remain fatal.

6. **Runner and checkout safety**
   - Reject unapproved `self-hosted` runners.
   - Reject checkout token overrides or unexpected secret injection.
   - Require pinned full 40-character action/reusable-workflow SHAs.
   - Preserve `persist-credentials: false` on checkout.
   - Detect unsafe secret exposure, shell exfiltration patterns and credential persistence.

7. **Scanner configuration integrity**
   - Reject Semgrep excludes, replacement configs or arguments that weaken/remove required scanning.
   - Reject CodeQL path exclusions or configuration changes that silently remove required source coverage.
   - Reject OSV scan-argument overrides that weaken vulnerability failure behaviour.
   - Reject Gitleaks config overrides or changes that weaken full-history scheduled scanning.
   - Reject removal or weakening of the scheduled full-history scan and branch/event restrictions that silently skip required scans.

8. **Preserve legitimate exceptions**
   - Do not solve this by banning all job-level permissions. CodeQL and OSV may need narrowly scoped `security-events: write`; validate the exact job and exact scope.
   - Do not weaken current immutable action/reusable-workflow pins.
   - Do not break legitimate workflow dispatch or scheduled scanning.

## A2-07: scanner scope and provenance

1. Expand Semgrep coverage to include:
   - `tools/`
   - `tests/`
   - `.github/workflows/`
   - relevant `templates/`, including `templates/ci/`

2. Prove actual coverage:
   - Report tracked files eligible for scanning.
   - Report scanned files and skipped files.
   - Explain every intentional skip with its path and reason.
   - Do not claim coverage from configuration alone.
   - Preserve fail-on-findings behaviour and pinned scanner image/version.

3. CodeQL:
   - Verify from current official CodeQL documentation/release sources whether the configured CodeQL language pack actually analyses GitHub Actions workflow files.
   - Do not assume JavaScript/TypeScript analysis covers YAML workflows.
   - If Actions workflow analysis is supported and suitable, implement it with a pinned action and least-privilege permissions.
   - If it is not supported by the current CodeQL setup, document the precise coverage limitation and identify which existing scanner covers those files. Do not invent a CodeQL language or claim unsupported coverage.

4. OSV:
   - Verify the pinned reusable workflow commit against the official upstream repository and the corresponding official release/tag.
   - Record the exact upstream URL, commit SHA, tag/release and verification method.
   - Keep immutable SHA pinning. Do not replace it with a mutable tag.
   - Preserve `fail-on-vuln: true` and least-privilege permissions.

5. Gitleaks:
   - Confirm the scheduled run scans full history.
   - Confirm push/PR scan ranges are appropriate.
   - Confirm configuration does not silently suppress findings or exclude required paths.

## Required execution and evidence

Before handing back:

1. Reproduce the current workflow validator behaviour and identify the exact missing checks.
2. Implement A2-02 and A2-07 only within your file ownership.
3. Add a negative regression test for every mutation above that is relevant to the current workflows.
4. Run targeted workflow-security tests.
5. Run the full test suite and project validation from a clean checkout using the repository's documented safe install procedure, including `npm ci --ignore-scripts`.
6. Run or trigger hosted CI if you have a distinct authenticated write-enabled GitHub identity.
7. Record exact commands, exit codes, test totals, scanner file counts, skipped-file counts, CodeQL coverage conclusion, OSV upstream pin evidence and hosted run/job IDs.
8. Inspect the final diff for accidental edits outside your ownership.

## Git identity and access rules

The connected `jayblisstech-bot` account was verified as pull-only for this repository. Do not push using the owner's identity, email or author metadata. Do not spoof provenance.

If you have a separate authenticated GitHub identity with write permission, verify that identity and its access before pushing. Otherwise, prepare a clean patch or commit in your authorised workspace and return it for owner-authorised integration. Do not claim a remote push occurred if it did not.

## Required handback format

Return:

- Finding: A2-02 / A2-07
- Starting branch HEAD and final patch/commit SHA
- Exact changed-file list
- Root cause for each defect
- Fix summary
- Mutation test name for each bypass and pass/fail result
- Exact commands and exit codes
- Full test totals
- Scanner tracked/scanned/skipped counts
- CodeQL Actions coverage conclusion with official source links
- OSV upstream SHA/tag provenance evidence
- Hosted CI run IDs and job conclusions, if available
- Any unresolved issue, limitation or owner decision
- Patch file or exact diff if you could not push

Do not mark findings independently verified or closed. Your task is implementation. ChatGPT will independently inspect your actual diff and evidence. PR #9 must remain open and unmerged. Do not change repository settings, publish a release, sign a release, or create the v1.0.0 tag.

Start now by syncing the branch and inspecting the current live files. Do not stop after analysis: implement the fixes you can safely complete, test them, and return the patch plus evidence.
