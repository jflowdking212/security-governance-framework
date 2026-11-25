# USS v1.0.0 Release Verification Checklist

**Current release candidate:** v1.0.0-rc.1  
This checklist tracks the release-readiness of the Universal Security Standard (USS) v1.0.0. The candidate version is `v1.0.0-rc.1`; the final `v1.0.0` release tag and release artefacts will be created during the owner's personal cryptographic signing ceremony.

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
- [x] PR #1 squash-merged into `main` after successful CI and substantive review.
- [x] Post-merge GitHub Actions passed on Node.js 20.20.2, including all 34 tests, at commit `dbb45e833bc82ac9435e5b751cea2c5491a29030`.
- [x] PNCUL 1.0 published by PR #4; repository remains public and proprietary/source-available.
- [x] Dependabot GitHub Actions updates configured weekly by PR #5; no unused package ecosystems configured.
- [x] Active `Protect Main` ruleset targets the default branch and requires pull requests, conversation resolution, and blocks deletion/non-fast-forward updates. Required approvals are 0 by owner decision.
- [x] `.github/CODEOWNERS` assigns security-critical policy, source, tooling and release-integrity files to `@jflowdking212`; mandatory code-owner approval remains disabled by owner decision.
- [ ] Require the `USS validation` status check before merge after hosted CI is available and the exact check name is confirmed.
- [x] Owner SSH signing key is registered with GitHub; local signing succeeded and GitHub verified test commit `cead9b6ebb6c904d71604134535083d89f0e8c75`.

## Trust and evidence correction series
- [x] Current Claude-review findings and implementation/owner-action status recorded in [REVIEW-CORRECTION-LOG.md](REVIEW-CORRECTION-LOG.md).
- [x] External trust-root limitations documented; consumers are required to pin a full commit SHA obtained through an independent trusted channel.
- [x] Machine-readable control-family catalog and structured evidence validator added.
- [x] Added a severity classification rubric clarifying P0-P3 evidence, reachability, impact and risk acceptance.
- [x] Added full-history Gitleaks, Semgrep, CodeQL and OSV-Scanner workflows.
- [ ] Confirm dependency-graph API access and enable GitHub Dependency Review if supported.
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
- [ ] All findings from the latest Claude review resolved or explicitly documented with an owner decision.
- [ ] Owner approves final release after GitHub CI and remaining substantive review.
- [x] Publish `SECURITY-ROOT.pub` and `.security/allowed_signers` containing the owner's public SSH signing key; local fingerprint matches `SHA256:zfXCAflnGbD1984rV8kabaPj92UyXIs0gCVsIspIX/o`, GitHub verified signed publication commit `4f05a3e730aa8491795a6d9cff179ff58219fcb6`, and the owner independently ran `git verify-commit` successfully using the published allowed-signers file. Independent out-of-band confirmation of the fingerprint remains part of consumer trust bootstrap.
- [x] Owner workstation successfully tested temporary filesystem-mode manifest creation, SSH signing with namespace `USS-SHA256SUMS`, signature verification against the published `.security/allowed_signers`, and file-digest verification. A modified protected file was rejected with `SHA-256 mismatch`; a modified manifest was rejected with `incorrect signature`; the original manifest signature verified again after restoration. This is workflow evidence only, not the final release manifest.
- [ ] Generate and sign `SHA256SUMS` for the exact release candidate using `tools/checksums.mjs`; verify the signature and file set independently.
- [ ] Create a signed annotated `v1.0.0` tag and independently verify the tag, commit, checksum signature and every file digest.
- [ ] Require the `USS validation` status check before merge in ruleset `Protect Main` once hosted CI is confirmed.
- [ ] Owner approves the final release after all P0/P1 findings, local validation and hosted CI are complete.
- [ ] Consuming applications pin the signed release commit in `.uss-version` and verify the checksum-manifest digest and any project-profile digest before loading policy.
- [ ] P2.10 stack profiles remain NOT VERIFIED until exercised against real applications; do not claim they are verified by documentation alone.

**Current status:** Main contains the base modular standard, PNCUL 1.0 licence (PR #4), Dependabot configuration (PR #5), and active `Protect Main` ruleset. The integration branch combines PR #3 (routing, evidence validation, security scanners) and PR #8 (trust root, checksum manifest, SSH signing). Local validation and automated test suites are required before final owner approval and release tag creation.
