# USS v1.0.0 Release Verification Checklist

- **Current release candidate:** `v1.0.0-rc.1`
- **Current `main` HEAD (2026-11-25):** `53d45c2fee0fa2664fdc4e4c3372ac8971ed959d` (PR #11 `1bb8a6ef...`, PR #12 `23d1047a...`, PR #13 `53d45c2f...`)
- **Current release-readiness branch:** `gemini/v1-release-readiness` (technical closure `68c373f2e0eb0474c718ceb03cae4a8b5cb53ab3`; documentation reconciliation follows)
- **Release posture:** NOT SIGNED OR APPROVED FOR RELEASE. The final `v1.0.0` release commit, `SHA256SUMS` manifests/signatures, signed annotated tag, and GitHub release publication remain owner-only actions on the trusted workstation.

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
- [x] PR #1 squash-merged into `main` (`dbb45e833bc82ac9435e5b751cea2c5491a29030`), followed by PR #11 (`1bb8a6ef...`), PR #12 (`23d1047a...`), and PR #13 (`53d45c2f...`).
- [x] Post-merge GitHub Actions passed on Node.js 20 at `53d45c2fee0fa2664fdc4e4c3372ac8971ed959d` (`USS validation` run `45598306667`, `USS security scans` run `45598307399`).
- [x] PNCUL 1.0 published by PR #4; repository remains public and proprietary/source-available.
- [x] Dependabot GitHub Actions updates configured weekly by PR #5; no unused package ecosystems configured.
- [x] Active `Protect Main` ruleset targets the default branch and requires pull requests, conversation resolution, and blocks deletion/non-fast-forward updates. Required approvals are 0 by owner decision.
- [x] `.github/CODEOWNERS` assigns security-critical policy, source, tooling and release-integrity files to `@jflowdking212`; mandatory code-owner approval remains disabled by owner decision.
- [ ] Require the 5 GitHub Actions status checks (`validate` + the 4 `USS security scans` jobs) in ruleset `Protect Main` (`ID 27612394`) with `integration_id: 15368`, preserving `required_approving_review_count: 0` (`U-08`).
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
- [x] Findings F-1 through F-7 from Claude's November 25 audit implemented and verified on `gemini/v1-release-readiness` (`3e6ce69...`, `84afc08...`, `ffe7105...`, `330cb4e...`, `68c373f...`), with Linux VPS passing `317/317` tests (`0` fail, `0` skipped).
- [ ] Owner reviews, approves, and merges `gemini/v1-release-readiness` into `main` after final hosted CI (`USS validation` & `USS security scans`) and any owner-directed independent review, and dispositions legacy/open PRs (`#3`, `#6`, `#7`, `#8`, `#9`).
- [x] Publish `SECURITY-ROOT.pub` and `.security/allowed_signers` containing the owner's public SSH signing key; local fingerprint matches `SHA256:zfXCAflnGbD1984rV8kabaPj92UyXIs0gCVsIspIX/o`, GitHub verified signed publication commit `4f05a3e730aa8491795a6d9cff179ff58219fcb6`, and the owner independently ran `git verify-commit` successfully using the published allowed-signers file. Independent out-of-band confirmation of the fingerprint remains part of consumer trust bootstrap.
- [x] Owner workstation (2026-11-19) and Gemini Linux VPS disposable-key dry run (`~/uss-verify/signing-dryrun`, 2026-11-25, cleaned on exit) verified `tools/checksums.mjs` create/verify (Git mode and `--root dist/bundles --filesystem`), `ssh-keygen -Y sign`/`verify` in namespace `USS-SHA256SUMS`, tamper rejection, and disposable SSH-signed commit/tag verification. Workflow evidence only; zero official signatures created.
- [ ] Owner generates and signs `SHA256SUMS` (repository root) and `dist/bundles/SHA256SUMS` (`--filesystem`) from the merged `main` release commit using `~/.ssh/security_layer_signing`; verify both signatures and file sets independently (`U-01`).
- [ ] Owner creates a signed release commit and signed annotated `v1.0.0` tag (`git commit -S`, `git tag -s`), pushes to `origin`, publishes the GitHub Release, and independently verifies tag, commit, signatures, and every digest (`U-01`).
- [ ] Owner configures `Protect Main` ruleset (`ID 27612394`) `required_status_checks` with the 5 GitHub Actions contexts (`integration_id: 15368`: `validate`, `Secret scan (commit range on push/PR, full history on schedule)`, `Semgrep static analysis`, `CodeQL JavaScript/TypeScript and GitHub Actions analysis`, `OSV dependency vulnerability scan / osv-scan`) while preserving `required_approving_review_count: 0` (`U-08`).
- [ ] Consuming applications pin the signed release commit in `.uss-version` and verify the checksum-manifest digest and any project-profile digest before loading policy.
- [ ] P2.10 / F-6 stack profiles remain `REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION` until exercised against real applications; do not claim they are verified by documentation alone.

## 2026-11-25 Release-Readiness Disposition Summary

- **IMPLEMENTED & VERIFIED:** `main` baseline `53d45c2fee0fa2664fdc4e4c3372ac8971ed959d` (PRs #11/#12/#13; hosted `USS validation` `45598306667` & `USS security scans` `45598307399` SUCCESS) plus `gemini/v1-release-readiness` technical commits through `68c373f2e0eb0474c718ceb03cae4a8b5cb53ab3` closing F-1..F-7 (`317/317` Linux VPS tests, disposable signing dry run pass).
- **NOT VERIFIED:** Consuming-application conformance (`stacks/*.md`), shipped Safari LNA release status, and hosted GitHub Actions CI + independent final re-review on the post-documentation final commit of `gemini/v1-release-readiness` until pushed and completed.
- **ACCEPTED RISK:** P3 backlog items (`REVIEW-CLAUDE.md` P3-1..P3-5), single-owner `required_approving_review_count: 0`, preserved archival Source 19.8 text with M20 supersession note, and `SHA256SUMS` exclusion of filesystem permissions/empty directories.
- **OWNER ACTION REQUIRED:** PR merge (`gemini/v1-release-readiness` -> `main`), legacy/open PR disposition (`#3`, `#6`, `#7`, `#8`, `#9`), `Protect Main` `required_status_checks` (`U-08`), and workstation SSH signing ceremony / `v1.0.0` release publication (`U-01`).

**Current status (2026-11-25):** `main` (`53d45c2f...`) has merged PRs #1, #4, #5, #11 (`1bb8a6ef...`), #12 (`23d1047a...`), and #13 (`53d45c2f...`). `gemini/v1-release-readiness` closes Claude's Nov 25 findings F-1 through F-7 and reconciles release documentation; hosted branch CI, owner PR merge, ruleset check configuration, and owner workstation signing remain required before official `v1.0.0` release publication.
