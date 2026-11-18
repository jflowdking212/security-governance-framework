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

## Automated checks
- [x] Module generator is reproducible in CI.
- [x] CI rejects stale/hand-edited generated modules.
- [x] Dependency graph, source references and source archive are validated.
- [x] Task resolver is tested across task keys.
- [x] Task bundles are compiled and checked for dependency closure.
- [x] Node test suite runs in GitHub Actions.

## Remaining before final v1.0.0 release
- [ ] Claude independent review completed.
- [ ] Claude findings resolved or explicitly documented.
- [ ] Owner accepts final review.
- [ ] Main branch protection configured with required USS validation checks and review.
- [ ] Final release commit/tag created.
- [ ] Consuming applications pin the released version.

**Current status:** Implementation and automated validation complete; independent review and owner approval remain.
