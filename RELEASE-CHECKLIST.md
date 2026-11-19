# USS v1.0.0 completion and release checklist

## Source preservation
- [x] Three original directives retained at repository root.
- [x] Exact source copies retained under `source/original-directives/`.
- [x] Validation checks root/archive byte equality.
- [x] Validation checks embedded Anti-Gravity global directive against standalone canonical source.
- [x] Traceability matrix covers global sections 1.A-1.G and 2-21, payment/tax supplement, Anti-Gravity execution contract and owner policy clarification.

## Modular architecture
- [x] 22 source-derived modules.
- [x] Authentication and authorisation separated.
- [x] Payments/webhooks and tax compliance separated.
- [x] Secrets, data protection, operations, AI, CI/CD, supply chain, CORS, assurance, audit and reporting modules.
- [x] Manifest records triggers, dependencies, task keys and source references.
- [x] Kernel and agent entrypoint direct agents to load only relevant modules and dependencies.
- [x] Gemini, Claude and ChatGPT adapters updated.
- [x] Deterministic module regeneration tool added.
- [x] Task resolver and on-demand bundle compiler added.

## Policy decisions
- [x] P0 and P1 are hard production-release blockers.
- [x] Agents/operators cannot waive, downgrade or silently accept P0/P1.
- [x] Risk acceptance applies only to P2/P3.
- [x] Unknown is not pass.
- [x] 13-layer framework named 13-Layer Security Assurance Model.

## Repository documentation and hygiene
- [x] Root README provides project overview, quick start, task catalogue and validation commands.
- [x] README local links are checked by the validator.
- [x] SECURITY.md documents private vulnerability reporting.
- [x] CONTRIBUTING.md documents source traceability and required checks.
- [x] .gitignore excludes generated bundles, local environments and common secret/key files.
- [x] Pull request template captures traceability, testing and release impact.
- [x] Custom Personal Non-Commercial Use Licence (PNCUL) 1.0 published in PR #4; permits private non-commercial use and private modifications, prohibits commercial use and redistribution outside applicable GitHub platform permissions.

## Independent review corrections
- [x] Mandatory M13 self-audit is reachable from every task through M01.
- [x] Source 19.8 P0/P1 exception is preserved but explicitly annotated as superseded in M20.
- [x] Domain modules carry the relevant verbatim Layer 1-12 checks.
- [x] Payment directive preamble is present in M06 and M07.
- [x] Routine routing no longer pulls audit-only modules.
- [x] Authentication, database, frontend and production-release task keys added.
- [x] Exact keyword resolver, generated indexes and semantic validation added.
- [x] Consuming guide, pinned-source instructions and CI hardening added.

## Automated checks
- [x] Module generator is reproducible in CI.
- [x] CI rejects stale/hand-edited generated modules.
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
- [ ] Require the `USS validation` status check before merge after hosted CI is available and the exact check name is confirmed.
- [x] Owner SSH signing key is registered with GitHub; local signing succeeded and GitHub verified test commit `cead9b6ebb6c904d71604134535083d89f0e8c75`.

## Remaining before final v1.0.0 release
- [x] Additional substantive review of M06, M07, M08, M10, M12 and M21 completed; no further internal policy contradictions identified.
- [x] GitHub Actions CI passed on Node.js 20, including source generation, index drift checks, validation and 34 automated tests.
- [x] Claude independent review completed (`REVIEW-CLAUDE.md`, 2026-11-18).
- [x] Claude findings resolved or explicitly documented in the correction series and review report.
- [ ] Owner approves final release after GitHub CI and remaining substantive review.
- [ ] Publish `SECURITY-ROOT.pub` and `.security/allowed_signers` containing the owner's public SSH signing key; verify the fingerprint against the independently trusted value in `SECURITY-ROOT.md`.
- [ ] Generate and sign `SHA256SUMS` for the exact release candidate using `tools/checksums.mjs`; verify the signature and file set independently.
- [ ] Create a signed annotated `v1.0.0` tag and independently verify the tag, commit, checksum signature and every file digest.
- [ ] Require the `USS validation` status check before merge after hosted CI is available and the exact check name is confirmed.
- [ ] Owner approves the final release after all P0/P1 findings, local validation and hosted CI are complete.
- [ ] Consuming applications pin the signed release commit in `.uss-version` and verify the checksum-manifest digest and any project-profile digest before loading policy.
- [ ] P2.10 stack profiles remain NOT VERIFIED until exercised against real applications; do not claim they are verified by documentation alone.

**Current status:** Main contains the correction series and governance updates. The last confirmed hosted CI pass was Node.js 20.20.2 with 34 tests at `dbb45e833bc82ac9435e5b751cea2c5491a29030`. PR #4 added the custom non-commercial licence and PR #5 added Dependabot configuration. Subsequent trust-root work is in progress. No formal signed v1.0.0 tag/release exists. Hosted CI is unavailable until 30 November 2026; local validation is required in the meantime.
