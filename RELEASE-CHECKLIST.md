# USS v1.0.0 Release Verification Checklist

- **Current target version:** `1.0.0` (unreleased — unsigned metadata preparation on `release/v1.0.0`, awaiting owner signing ceremony)
- **Current `main` HEAD (2026-11-25):** `f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda` (PR #14 merged `fb18d09581813e8213314cdbc611041bd70ea1bd`, following PR #11 `1bb8a6ef...`, PR #12 `23d1047a...`, PR #13 `53d45c2f...`)
- **Current release branch:** `release/v1.0.0` (branched cleanly from `main` `f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda`)
- **Release posture:** NOT SIGNED OR APPROVED FOR RELEASE. Official signatures (`SHA256SUMS.sig`), signed release commit, annotated `v1.0.0` tag, and GitHub Release publication remain owner-only actions.

This checklist tracks the release-readiness of the Universal Security Standard (USS) v1.0.0. Historical checkboxes below preserve the Nov 18–20 build/integration audit trail alongside the 2026-11-25 reconciliation section at the end.

## Clean checkout and test execution requirements
- [x] Run `npm ci --ignore-scripts` before executing automated test suites.
- [x] Verify zero dependencies required for core tools (`resolve-task.mjs`, `checksums.mjs`, `validate.mjs`, `validate-evidence.mjs`).
- [x] Verify `yaml@2.9.1` is used exclusively for workflow AST security tests.
- [x] Enforce `--ignore-scripts` to prohibit arbitrary lifecycle script execution during dependency installation.

## Review and provenance
- [x] Initial full-audit draft completed against the preserved source directives.
- [x] Traceability matrix created in `assurance/source-traceability.md`.
- [x] In-line self-audit checklist created in `modules/m13-self-audit.md`.
- [x] All 22 modules mapped to source sections and requirements.
- [x] Source archive verified and committed to `source/original-directives/`.
- [x] Independent human review completed and recorded.
- [x] Automated module consistency check implemented in `tools/validate.mjs`.

## Policy integrity
- [x] No source requirements omitted or silently weakened in modules.
- [x] P0/P1 non-waivability enforced across all modules.
- [x] P2/P3 risk-acceptance procedure documented in M17.
- [x] Mandatory rules in KERNEL.md match source authority.
- [x] Agent entrypoint in AGENTS.md defines task-oriented workflow.
- [x] Module index in MODULE-INDEX.md covers all 22 modules.
- [x] Manifest in `manifest.json` provides machine-readable task routing.

## Tooling and automation
- [x] Module generator (`tools/build-modules.mjs`) builds all modules from source.
- [x] Index generator (`tools/build-indexes.mjs`) builds `MODULE-INDEX.md`.
- [x] Task bundle compiler (`tools/build-bundles.mjs`) produces full-text bundles.
- [x] Validation tool (`tools/validate.mjs`) enforces consistency rules.
- [x] CI workflow (`.github/workflows/uss-validation.yml`) runs on push and PR.
- [x] CI workflow detects stale generated files.
- [x] CI workflow compiles task bundles.
- [x] CI workflow runs test suite on Node.js 20.
- [x] Automated test suite in `tests/` covers manifest, modules, routing, tasks and tools.

## Documentation
- [x] README.md provides clear overview and getting-started guide.
- [x] KERNEL.md provides 1-page fail-closed security core.
- [x] AGENTS.md provides concise agent entrypoint.
- [x] CONTRIBUTING.md defines change-proposal process.
- [x] CHANGELOG.md tracks versions and changes.
- [x] SECURITY.md provides vulnerability reporting process.
- [x] Tool-specific adapters created for Gemini, Claude and ChatGPT.
- [x] Implementation guides created for SafeSellz and Choir SaaS.

## Pre-merge verification
- [x] All generated files match source (`node tools/build-modules.mjs && git diff --exit-code`).
- [x] All indexes match manifest (`node tools/build-indexes.mjs && git diff --exit-code`).
- [x] Repository validation passes (`node tools/validate.mjs`).
- [x] Automated tests pass (`node --test tests/*.test.mjs`).
- [x] Full-audit bundle compiles and is complete.
- [x] Dependency graph, source references and source archive are validated.
- [x] Task resolver is tested across task keys.
- [x] Task bundles are compiled and checked for dependency closure.
- [x] Node test suite runs in GitHub Actions.

## Main branch publication
- [x] PR #1 squash-merged into `main` (`dbb45e833bc82ac9435e5b751cea2c5491a29030`), followed by PR #11 (`1bb8a6ef...`), PR #12 (`23d1047a...`), PR #13 (`53d45c2f...`), and PR #14 (`fb18d09581813e8213314cdbc611041bd70ea1bd` -> `f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda`).
- [x] Post-merge GitHub Actions passed on Node.js 20 at `f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda` (`USS validation` run `45631844618` `317/317`, `USS security scans` run `45631845175`, plus Linux VPS explicit full-history Gitleaks `0` leaks).
- [x] PNCUL 1.0 published by PR #4; repository remains public and proprietary/source-available.
- [x] Dependabot GitHub Actions updates configured weekly by PR #5; no unused package ecosystems configured.
- [x] Active `Protect Main` ruleset (`ID 27612394`) targets the default branch and requires pull requests, conversation resolution, all five mandatory GitHub Actions check contexts (`integration_id: 15368`, `strict_required_status_checks_policy: true`), and blocks deletion/non-fast-forward updates. Required human approvals are `0` by owner decision (`bypass_actors: []`).
- [x] `.github/CODEOWNERS` assigns security-critical policy, source, tooling and release-integrity files to `@jflowdking212`; mandatory code-owner approval remains disabled by owner decision.
- [x] Required the 5 GitHub Actions status checks (`validate`, `Secret scan (commit range on push/PR, full history on schedule)`, `Semgrep static analysis`, `CodeQL JavaScript/TypeScript and GitHub Actions analysis`, `OSV dependency vulnerability scan / osv-scan`) in ruleset `Protect Main` (`ID 27612394`, updated `2026-11-25T14:58:22.193+01:00`) with `integration_id: 15368`, preserving `required_approving_review_count: 0` (`U-08` completed).
- [x] Owner SSH signing key is registered with GitHub; local signing succeeded and GitHub verified test commit `cead9b6ebb6c904d71604134535083d89f0e8c75`.

## Trust and evidence correction series
- [x] Current Claude-review findings and implementation/owner-action status recorded in [REVIEW-CORRECTION-LOG.md](REVIEW-CORRECTION-LOG.md).
- [x] External trust-root limitations documented; consumers are required to pin a full commit SHA obtained through an independent trusted channel.
- [x] Machine-readable control-family catalog and structured evidence validator added.
- [x] Added a severity classification rubric clarifying P0-P3 evidence, reachability, impact and risk acceptance.
- [x] Added full-history Gitleaks, Semgrep, CodeQL and OSV-Scanner workflows.
- [x] Dependency graph and Dependabot security updates verified enabled via GitHub repository API (`security_and_analysis`); GitHub Dependency Review action remains deferred (`ACCEPTED RISK` / `NOT VERIFIED`) in favor of pinned `OSV-Scanner`.
- [x] Pinned direct GitHub Actions and reusable workflow references to full commit SHAs.
- [x] Added workflow tests for scanner coverage and action pinning.
- [x] Added a consumer CI security workflow template with explicit language, dependency and permission adaptation notes.
- [x] AI, identity, SSRF, API, cryptography, privacy and runtime implementation supplements added.
- [ ] Signed release tag/artefact created and independently verifiable against an owner-published signer identity.
- [x] Repository branch protection ruleset `Protect Main` configured by owner and active on 2026-11-19; requires pull requests, conversation resolution, and blocks deletion and force-pushes.
- [x] PNCUL 1.0 (Personal Non-Commercial Use Licence) published by PR #4 on 2026-11-19; repository is public and source-available.

## Remaining before final v1.0.0 release
- [x] Additional substantive review of M06, M07, M08, M10, M12 and M21 completed; no further internal policy contradictions identified.
- [x] GitHub Actions CI passed on Node.js 20, including source generation, index drift checks, validation and 34 automated tests.
- [x] Claude independent review completed (`REVIEW-CLAUDE.md`, 2026-11-18).
- [x] Findings F-1 through F-7 from Claude's November 25 audit implemented, verified on Linux VPS (`317/317`) and hosted CI (`45626183583` / `45626185054`), and merged into `main` via PR #14 (`f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda`).
- [x] Unsigned `1.0.0` metadata preparation completed on `release/v1.0.0` (`manifest.json` `"status": "awaiting-owner-signing"`, `CHANGELOG.md` `Unreleased` header).
- [x] Publish `SECURITY-ROOT.pub` and `.security/allowed_signers` containing the owner's public SSH signing key; local fingerprint matches `SHA256:zfXCAflnGbD1984rV8kabaPj92UyXIs0gCVsIspIX/o`, GitHub verified signed publication commit `4f05a3e730aa8491795a6d9cff179ff58219fcb6`, and the owner independently ran `git verify-commit` successfully using the published allowed-signers file. Independent out-of-band confirmation of the fingerprint remains part of consumer trust bootstrap.
- [x] Owner workstation (2026-11-19) and Gemini Linux VPS disposable-key dry runs (including `1.0.0` + `--merge` workflow simulation on `f584ab95...`) verified `tools/checksums.mjs` create/verify (Git mode and `--root dist/bundles --filesystem`), `ssh-keygen -Y sign`/`verify` in namespace `USS-SHA256SUMS`, tamper rejection, and disposable SSH-signed commit/tag verification. Workflow evidence only; zero official signatures created.
- [ ] Owner generates and signs `SHA256SUMS` (repository root) and `dist/bundles/SHA256SUMS` (`--filesystem`) on Linux/WSL2 from `release/v1.0.0` using `~/.ssh/security_layer_signing`; verify both signatures and file sets independently (`U-01`).
- [ ] Owner commits signed manifests on `release/v1.0.0` (`git commit -S`), opens PR to `main`, merges with `--merge` once all five `Protect Main` required checks pass, creates & pushes signed annotated `v1.0.0` tag (`git tag -s v1.0.0`), and publishes the GitHub Release attaching `dist/bundles/*.md`, `dist/bundles/SHA256SUMS`, and `dist/bundles/SHA256SUMS.sig` (`U-01`).
- [ ] Owner closes legacy/superseded PRs (`#3`, `#8`, `#9`) and Dependabot PRs (`#6`, `#7`).
- [ ] Consuming applications pin the signed release commit in `.uss-version` and verify the checksum-manifest digest and any project-profile digest before loading policy.
- [ ] P2.10 / F-6 stack profiles remain `REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION` until exercised against real applications; do not claim they are verified by documentation alone.

## 2026-11-25 Release-Readiness Disposition Summary

- **IMPLEMENTED & VERIFIED:** `main` at `f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda` (PRs #11/#12/#13/#14 merged; post-merge hosted `USS validation` `45631844618` `317/317` & `USS security scans` `45631845175` + full-history Gitleaks `0` leaks), `Protect Main` (`ID 27612394`) enforcing all five required checks (`U-08` complete), and unsigned `1.0.0` version preparation on `release/v1.0.0`.
- **NOT VERIFIED:** Consuming-application conformance (`stacks/*.md`), shipped Safari LNA release status, and hosted CI on the new unsigned `release/v1.0.0` commit until pushed and observed complete.
- **ACCEPTED RISK:** P3 backlog items (`REVIEW-CLAUDE.md` P3-1..P3-5), single-owner `required_approving_review_count: 0`, preserved archival Source 19.8 text with M20 supersession note, and `SHA256SUMS` exclusion of filesystem permissions/empty directories.
- **OWNER ACTION REQUIRED:** Review unsigned `release/v1.0.0` metadata commit, execute workstation SSH signing ceremony (`SHA256SUMS`, `dist/bundles/SHA256SUMS`, `.sig`, `git commit -S`), merge signed-manifest PR via `--merge` into `main`, tag `v1.0.0`, publish GitHub Release (`U-01`), and close open PRs `#3`, `#6`, `#7`, `#8`, `#9`.

**Current status (2026-11-25):** `main` (`f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda`) has merged PR #14 and enforces all five mandatory GitHub Actions status checks in `Protect Main` (`ID 27612394`). Branch `release/v1.0.0` carries unsigned `1.0.0` preparation; USS `v1.0.0` remains unreleased until owner signing and publication.
