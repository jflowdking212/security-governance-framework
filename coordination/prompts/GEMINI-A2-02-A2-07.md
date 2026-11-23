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


---

## Supervisory follow-up addendum — required before A2-02/A2-07 can be marked implemented

**Issued by:** ChatGPT supervisory review  
**Live review baseline:** PR #9 head `4fff3c7e87fc52350392bc9e4eec4d82cba8280e`  
**Implementation owner:** Gemini  
**Scope remains limited to A2-02/A2-07 files listed above.**

The first implementation is present, but direct inspection of the live files shows that the validator still does not enforce several controls already required by this prompt. Do not report A2-02/A2-07 complete until each item below has a dedicated negative mutation test that fails against the vulnerable mutation and passes against the legitimate baseline.

### Confirmed gaps from live-source inspection

1. `validateWorkflowSecurity()` scans untrusted expressions in `step.run` only. It does not inspect workflow-level, job-level or step-level `env` values. An attacker can move an unsafe expression out of `run:` and into an environment variable consumed by a shell command.
2. Runner validation accepts arrays containing `ubuntu-latest` plus arbitrary extra labels, and does not reject object-form or expression-based selectors. Require the exact approved runner representation for these workflows. Reject arrays, objects, expressions, dynamic selectors and all self-hosted combinations unless an explicitly approved exact form is documented.
3. The OSV check validates `uses` prefix and `fail-on-vuln: true`, but does not reject unsafe reusable-workflow input overrides such as `scan-args`, `runs-on`, `ref`, or other unapproved inputs. Enforce an explicit input allowlist for the pinned upstream workflow and test every prohibited override.
4. The Semgrep check does not enforce the exact approved rule configuration. It checks for `--error` and target paths, but a different or additional `--config` can be substituted. Enforce the approved config, required arguments and scope, rejecting duplicate/config-file overrides, excludes, rule exclusions and environment-based weakening.
5. Gitleaks checks the action and comments setting, but do not protect configuration/ignore/allowlist overrides or all artifact-output settings. Add an explicit safe environment/configuration allowlist and mutation tests.
6. The consumer template receives only generic workflow validation plus a weak Semgrep substring check. It does not receive the same scanner-specific Gitleaks, Semgrep, CodeQL and OSV invariants as the repository workflow. Add template-specific scanner validation and negative mutations for each scanner.
7. Trigger validation checks only trigger names. It does not validate branch/event filters. The current security workflow restricts `pull_request` to `main`, while PR #9 targets `integration/uss-pr3-pr8-hardening`. Confirm and enforce the intended PR coverage for both the active integration target and main. Reject narrowing push scans to main-only or otherwise silently skipping required branch/event coverage.
8. Add adversarial mutations for error masking beyond the existing patterns, including shell no-op fallbacks and alternative errexit disabling where applicable. Keep tests tied to parsed YAML fields, not only regexes over a single command string.

### Required acceptance tests

- Inject `github.event`, `github.actor`, `github.head_ref`, `github.ref_name`, `github.base_ref` and `inputs.*` into workflow/job/step `env`; each unsafe case must be rejected.
- Replace `runs-on` with an array containing `ubuntu-latest` plus another label, an object mapping, and an expression/dynamic value; each must be rejected.
- Add OSV `scan-args`, `runs-on`, `ref` and unknown `with` keys; each must be rejected.
- Replace or supplement Semgrep `p/default` with a custom config, add duplicate `--config`, `--exclude`, `--exclude-rule`, or weakening environment values; each must be rejected.
- Add Gitleaks config/ignore/allowlist overrides and re-enable artifact upload or comments; each must be rejected.
- Delete each required scanner from the consumer template, weaken each scanner's required configuration, and inject prohibited inputs; each mutation must be rejected.
- Narrow push branches to `main` only and remove the active integration PR target from the PR filter; each must be rejected.
- Prove the untouched repository workflows and consumer template still pass.

### Delivery requirements

1. Fetch the current live branch head before editing. The baseline above may have advanced; use the latest SHA and state it in the handback.
2. Reproduce each gap first, then implement the validator and tests.
3. Keep edits strictly within A2-02/A2-07 ownership. Do not edit checksum, evidence, stack-profile or shared handoff files.
4. Run targeted workflow tests, the complete test suite, repository validation, and scanner coverage checks.
5. Return exact changed paths, base/final SHA or patch hash, all mutation test names/results, exact commands/exit codes, test totals, scanner counts and hosted CI run/job IDs.
6. Do not claim independent closure. ChatGPT will inspect the actual diff and reproduce the attacks; Claude will independently audit the exact integrated SHA.
7. Keep PR #9 open and unmerged. No release, tag, signing ceremony or ruleset changes.

**Priority:** Complete this follow-up before spending time on cosmetic refactoring. The required result is a fail-closed workflow-security guard that detects configuration bypasses in both first-party workflows and the consumer template.


---

## Supervisory implementation update: ChatGPT has continued without waiting for Gemini

**Current direction:** Do not duplicate or overwrite the owner-issued implementation now present on the PR branch. ChatGPT has taken over the follow-up work and has added further controls.

### Additional implemented controls to inspect independently

1. First-party and consumer Gitleaks/Semgrep jobs now execute a fail-closed scanner-configuration guard before scanning.
2. The guard rejects Gitleaks config/ignore files, Semgrep config files, CodeQL config files, nested .semgrepignore files and symlinked root .semgrepignore.
3. It permits only the harmless root .semgrepignore entries .git/ and node_modules/.
4. It uses git check-ignore --no-index to detect tracked files hidden by .gitignore within the actual Semgrep scan scope. The consumer template checks all tracked files because it scans the whole repository.
5. Semgrep runs with both --error and --strict; the validator rejects --suppress-errors.
6. CodeQL now explicitly includes the actions language alongside javascript-typescript. Verify the live job log extracts and analyzes the first-party workflow files and consumer template.
7. The consumer template receives the same scanner-specific checks as the first-party workflow, including exact Gitleaks, Semgrep, CodeQL and OSV configuration.

### Your next task is an independent review, not a duplicate implementation

Fetch the latest PR head and inspect the actual live files and CI. Reproduce the adversarial cases, especially nested ignore files, .gitignore-hidden tracked targets, Gitleaks config/ignore files, Semgrep CLI error suppression, CodeQL Actions language, unsafe OSV inputs and dynamic runners.

Return only evidence-backed findings with exact file/line, severity, reproduction, and exact tested SHA. If you find a defect, propose a minimal patch in your own authorized workspace. Do not modify the shared handoff ledger. Do not claim independent closure from a green CI run alone. PR #9 remains open and unmerged.


---

## Urgent supervisory follow-up — repair scanner topology and failing tests before further hardening

**Issued:** 2026-11-20  
**Live PR HEAD at review:** `f57d6ce600538736925b4af62321a715db49d16c`  
**Failed validation:** run `44737872939`, job `136293734824`  
**Failed security scan:** run `44737873441`, job `136293737777`

### Confirmed live failures

The current hosted validation run executed 177 tests: **154 passed, 23 failed**. The failures are concentrated in the workflow-security tests.

The current `.github/workflows/security-scans.yml` contains only these job IDs:

- `gitleaks`
- `codeql`
- `osv`

There is no separate `semgrep` job, even though `validateSecurityScansWorkflow()` and its mutation tests require `jobs.semgrep`. As a result, the baseline security-workflow test fails with `security-scans.yml must contain semgrep job`, and multiple mutation tests then throw TypeErrors while trying to mutate the missing job.

More seriously, the current `gitleaks` job is not running Gitleaks. Its third step runs:

```sh
semgrep scan --config p/default --error --strict --metrics=off --verbose tools/ tests/ .github/workflows/ templates/
```

The job log confirms this command exits **127 (command not found)** on `ubuntu-latest`. There is no `gitleaks/gitleaks-action` invocation in the current first-party workflow. The consumer template has the same topology problem: its `secrets` job runs Semgrep directly on `ubuntu-latest`, and no separate Semgrep job/container is declared.

Therefore, the current hosted scan run does **not** prove Gitleaks or Semgrep coverage.

### Required correction

1. Restore two distinct scanner jobs in both first-party workflow and consumer template:
   - Gitleaks job: pinned checkout, exact scanner-config guard, then the pinned `gitleaks/gitleaks-action` SHA with the reviewed least-privilege environment. Keep full-history checkout where required and preserve the scheduled full-history behaviour.
   - Semgrep job: a separate job with the immutable pinned Semgrep container image digest, checkout, exact scanner-config guard and the exact approved `semgrep scan --config p/default --error --strict ...` command and target scope.
2. Keep CodeQL and OSV as separate jobs with their current pinned actions/reusable workflow and least-privilege permissions.
3. The first-party workflow and consumer template must both actually execute all four scanners: Gitleaks, Semgrep, CodeQL and OSV. Do not rename a Semgrep job to Gitleaks or treat a successful job name as proof of scanner execution.
4. Align the validator with the intended actual job IDs and topology. Do not weaken scanner requirements to make the current workflow pass.
5. Repair mutation tests so each fixture mutates an existing, explicit job/step. A missing job must fail with a clear assertion, not throw a TypeError before the intended assertion. Add explicit negative tests proving:
   - removal/renaming of the Gitleaks job or action is rejected;
   - removal/renaming of the Semgrep job or container is rejected;
   - Semgrep cannot be run on a bare Ubuntu runner without the pinned container or another explicitly pinned, verified installation method;
   - the consumer template independently enforces the same two scanner jobs.
6. Keep the scanner configuration guard, exact Semgrep config/scope, Gitleaks config restrictions, branch coverage, action pins, and error-fatal behaviour intact.
7. Do not suppress, skip or mark the current 23 failing tests as expected. Fix the underlying topology and fixtures.

### Acceptance evidence

On the exact resulting PR HEAD, provide:

- targeted workflow-security tests: all pass;
- complete `node --test tests/*.test.mjs`: all pass, with exact total;
- `node tools/validate.mjs` and generated-file drift checks: pass;
- fresh hosted USS validation: success;
- fresh hosted security scans with **four distinct successful scanner jobs**: Gitleaks, Semgrep, CodeQL and OSV;
- Semgrep tracked/scanned/skipped counts and findings;
- Gitleaks job log showing the pinned Gitleaks action actually ran, not merely a job named “Secret scan”;
- exact commit SHA, changed files, commands, exit codes and run/job IDs.

The prior run IDs above are failure evidence, not acceptance evidence. Fetch the current remote branch head before editing, work from that exact head, and report any intervening changes. Keep all changes within A2-02/A2-07 ownership. Do not edit checksum/evidence-validator/stack files or the shared handoff ledger. PR #9 remains open and unmerged; no release or signing actions.


### Semgrep CLI flag clarification
The current Semgrep container uses semgrep scan, not semgrep ci. For this command, --strict is the supported scan-specific flag that makes structured scan errors fatal; --no-suppress-errors is a semgrep ci option and must not be passed to semgrep scan. Keep --error for findings and --strict for scan errors. Verify this against the pinned Semgrep 1.186.0 CLI and current CI logs.


---

## Resolution of the urgent workflow-topology note

The topology concern recorded against the older snapshot `f57d6ce` is resolved in the current branch. That snapshot was damaged by an incorrect file-block replacement. The workflows were restored from the known-good `39d72f6f` revision and the guard was then inserted separately into the correct Gitleaks and Semgrep jobs.

Current intended topology:
- First-party security workflow: four distinct jobs named `gitleaks`, `semgrep`, `codeql`, and `osv`.
- Consumer template: four distinct jobs named `secrets`, `semgrep`, `codeql`, and `osv`.
- Gitleaks uses its pinned action; Semgrep uses the pinned container; CodeQL uses JavaScript/TypeScript plus Actions; OSV uses the pinned reusable workflow.

Two subsequent Semgrep execution issues were also corrected:
1. The scanner container initially rejected Git operations because the checked-out repository was owned by a different host/container user. The guard now uses the exact workspace path as a per-command Git safe.directory and disables core.fsmonitor.
2. The Semgrep 1.186.0 image does not support `--no-suppress-errors` on `semgrep scan`. The supported scan-specific `--strict` option is now used alongside `--error`; the validator rejects `--no-error`, `--no-strict` and `--suppress-errors` mutations.

At commit `b0bf7bdf`, USS validation passed 177/177 tests, including the runtime guard integration test. That result predates the final Semgrep CLI correction. The latest validation and scanner runs after the correction are pending and must be checked before reporting the current head as green. Do not reuse the older topology-failure note as the current branch status.


---

## Final adversarial coverage review after scanner topology repair

**Issued:** 2026-11-20  
**Latest PR HEAD to synchronise from:** `570b36185c1e4e2e50a8c4a6898e07c429c1c3b4`  
**Previous scanner-repair head with successful hosted checks:** `ee0f93590610dea443a42c8243b125f8129e7dab`

The scanner topology regression has been corrected in the branch. At `ee0f935`, the hosted validation suite passed **177/177 tests**, and the four distinct scanner jobs completed successfully:

- Gitleaks: pinned action actually ran; 30 commits scanned; no leaks found.
- Semgrep: 26 tracked files scanned, 237 rules run, 0 findings, 0 skipped targets reported, approximately 100% parsed lines.
- CodeQL: successful analysis, including GitHub Actions workflow files.
- OSV: successful scan and SARIF upload.

Do not repeat the earlier claim that Gitleaks/Semgrep are absent. The new task is to establish whether the remaining A2-02/A2-07 mutation and provenance requirements are actually complete.

### Required work

1. Synchronise to the latest remote head before inspection. Note that ChatGPT has since made owner-issued documentation-only updates to M21 and the Node.js, FastAPI and Laravel stack profiles. Do not overwrite or revert them.
2. Build a requirement-to-test matrix from the full A2-02/A2-07 assignment and original Claude A2-02/A2-07 findings. For each requirement, identify the exact validator function and negative test that rejects the mutation.
3. Recheck actual parsed YAML validation for:
   - workflow and job permissions, including exact exceptions for CodeQL/OSV;
   - all unapproved triggers and branch/event narrowing;
   - direct untrusted expressions in dot and bracket notation, plus expression movement into workflow/job/step `env` and action `with`;
   - dynamic runner selectors, arrays and object selectors;
   - disabled/conditional mandatory jobs and steps, optional dependencies and `continue-on-error`;
   - missing, reordered or replaced validation/scanner steps;
   - shell error suppression, command substitution and unsafe credential exposure;
   - checkout credential persistence and mutable action pins;
   - Gitleaks config/ignore overrides and complete-history scheduled scanning;
   - Semgrep config replacement, duplicate config, ignore/exclude weakening, image digest and exact scan targets;
   - CodeQL path/config overrides and the actual Actions workflow coverage;
   - OSV `runs-on`, `ref`, `scan-args`, inputs and permissions;
   - consumer template independently enforcing the same scanner controls.
4. Specifically test the scanner configuration guard against symlinked config/ignore files, nested ignore files, tracked scan targets excluded by `.gitignore`, and malicious Git configuration. Do not rely on a job name or YAML shape alone as proof that the executable scanner ran.
5. Verify the OSV reusable-workflow SHA against the official upstream repository and immutable release/tag provenance. Record the URL, tag and commit relationship. Verify Gitleaks full-history behaviour for the scheduled trigger and commit-range behaviour for push/PR.
6. Add only missing negative mutation tests or narrow validator fixes. Do not weaken existing checks, change scanner versions/pins, or edit files outside A2-02/A2-07 ownership.
7. Run targeted tests, all repository tests, project validation and generated-file drift checks on the exact latest source. Obtain fresh hosted CI on the resulting head and record run/job IDs and logs.

### Required handback

Return a complete matrix with PASS / GAP / NOT VERIFIED for every requirement, exact test names, source line/function references, changed files, final SHA, commands and exit codes. Report Semgrep scanned/skipped/partial-parse counts and the Gitleaks scanned commit count. If no additional code change is necessary, say so explicitly and provide the evidence. Do not edit the shared handoff ledger. Do not merge, sign, tag or publish a release.


---

## Urgent F5-R1 follow-up: embedded scanner guards still vulnerable

**Issued by:** ChatGPT supervisory engineer  
**Live source baseline:** Gemini branch handoff commit `18dafdf526fa8d79e778cd9ee55d543a14a52a34`  
**Finding:** F5-R1 remains OPEN.

A fresh inspection of the exact live source shows that the standalone `tools/uss-tracked-binary-scanner.py` uses component-by-component `dir_fd` traversal with `O_DIRECTORY | O_NOFOLLOW`, but the duplicated Python scanner in both `.github/workflows/security-scans.yml` and `templates/ci/consumer-security-scans.yml` still uses path-based `os.lstat(target_path)` followed by `os.open(target_path, O_NOFOLLOW)`. `O_NOFOLLOW` protects only the leaf, not parent components. The canonical embedded guard in `tools/validate-consumer-workflow.mjs` also retains this vulnerable code. Existing F5 tests exercise the standalone scanner and clean/malicious NUL files, but do not reproduce the parent-directory symlink redirection against all three embedded copies.

### Required implementation (Gemini A2-02/A2-07 ownership)

1. Port the secure directory-descriptor traversal into both workflow guard scripts and the canonical consumer guard generator. Keep implementation behaviour aligned across all copies.
2. Make unsupported platforms fail closed by default. Do not retain a path-based fallback that can report a successful scan while parent-component race resistance is unavailable. The approved GitHub Actions runner is Linux; Windows local tests must assert the documented fail-closed result.
3. Add a shared regression fixture that stages a tracked NUL-containing file such as `dir/file.txt`, replaces `dir` with a symlink to an external directory containing a clean `file.txt`, and proves each scanner/guard rejects or fails closed. Confirm independently that `git show :dir/file.txt` still contains the NUL byte.
4. Exercise the standalone scanner, the exact embedded script from the first-party workflow, the exact embedded script from the consumer template, and the canonical guard generated by `tools/validate-consumer-workflow.mjs`.
5. Add a positive nested regular-file test and explicit unsupported-platform test.
6. Add validator mutations proving that removal or weakening of the component-wise traversal is rejected in both workflows and the consumer template.
7. Run targeted workflow tests, full `npm test`, `node tools/validate.mjs`, evidence validation, all generator drift checks, Semgrep, Gitleaks and OSV. Provide exact commands, exit codes, test totals and scanner coverage. Hosted CI must be reported only if actual run and job IDs exist.
8. Do not edit `tools/checksums.mjs`, `tests/checksums.test.mjs`, evidence-validator files, stack profiles or the shared handoff ledger. Return your exact patch/commit and raw evidence to ChatGPT. The connected bot account is read-only; do not push as the owner or spoof identity.

### Acceptance boundary

F5-R1 remains OPEN until the four implementations (standalone, first-party workflow, consumer template, canonical validator generator) use equivalent secure traversal, the adversarial parent-symlink regression passes against every copy, unsupported platforms fail closed, and ChatGPT independently verifies the exact resulting diff. Do not merge PR #9, modify main, sign, tag, publish or deploy.
