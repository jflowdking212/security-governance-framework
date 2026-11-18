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
- [x] No license was invented; README explains that reuse permission has not been granted.

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
- [x] Post-merge GitHub Actions passed on Node.js 20.20.2, including all 34 tests.

## Trust and evidence correction series
- [x] External trust-root limitations documented; consumers are required to pin a full commit SHA obtained through an independent trusted channel.
- [x] Machine-readable control-family catalog and structured evidence validator added.
- [x] Added a severity classification rubric clarifying P0-P3 evidence, reachability, impact and risk acceptance.
- [x] Added full-history Gitleaks, Semgrep, CodeQL and OSV-Scanner workflows.
- [ ] Confirm dependency-graph API access and enable GitHub Dependency Review if supported.
- [x] Pinned direct GitHub Actions and reusable workflow references to full commit SHAs.
- [x] Added workflow tests for scanner coverage and action pinning.
- [x] AI, identity, SSRF, API, cryptography, privacy and runtime implementation supplements added.
- [ ] Signed release tag/artefact created and independently verifiable against an owner-published signer identity.
- [ ] Repository branch protection and required human review verified by the owner.
- [ ] Owner selects and approves a software licence, or explicitly retains the no-licence state.

## Remaining before final v1.0.0 release
- [x] Additional substantive review of M06, M07, M08, M10, M12 and M21 completed; no further internal policy contradictions identified.
- [x] GitHub Actions CI passed on Node.js 20, including source generation, index drift checks, validation and 34 automated tests.
- [x] Claude independent review completed (`REVIEW-CLAUDE.md`, 2026-11-18).
- [ ] All findings from the latest Claude review resolved or explicitly documented with an owner decision.
- [ ] Owner approves final release after GitHub CI and remaining substantive review.
- [ ] Main branch protection configured with required USS validation checks and review. The repository rulesets query returned no rulesets; classic branch-protection status could not be verified because the connected GitHub integration returned HTTP 403. Owner must confirm in GitHub Settings.
- [ ] Final release commit/tag created.
- [ ] Consuming applications pin the released version.

**Current status:** The previous modular-standard correction baseline is merged into `main` at `dbb45e833bc82ac9435e5b751cea2c5491a29030`. The new Claude-review correction series is being developed in draft PR #3 and has not been merged. The latest recorded CI run for the current branch passed after the M1-M4 evidence-validator changes. No formal v1.0.0 tag/release or independently verifiable signature has been created. Branch protection, licence choice and final owner approval remain outstanding.
