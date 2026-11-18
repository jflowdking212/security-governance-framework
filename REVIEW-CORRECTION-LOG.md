# Claude review correction log

**Review correction branch:** fix/claude-review-m1-resolver-routing-tests  
**Status date:** 2026-11-18  
**Merge status:** Draft PR #3. Nothing in this correction series has been merged into main.

This log tracks the findings as summarised during the latest Claude review discussion. It is not a replacement for Claude's full original report. The independent reviewer should re-check each change against the exact finding and the current repository diff.

| Finding | Correction and evidence | Status |
|---|---|---|
| P1.1 - Missing concrete security controls | Added implementation supplements for OAuth/OIDC/JWT/MFA, SSRF, GraphQL/WebSocket/gRPC, cryptographic storage, data lifecycle/privacy and container/cloud runtime. | Implemented as supplemental guidance; application-level verification remains with each consumer. |
| P1.2 - Missing deterministic security enforcement | Added Gitleaks full-history scan, Semgrep, CodeQL, OSV-Scanner, control catalog, evidence validator, CI tests and a consumer workflow template. | IMPLEMENTED, VERIFICATION PENDING. Workflow files and evidence validator are verified locally (action SHA pins checked; 84 tests pass on Node 20.20.2). Gitleaks, Semgrep, CodeQL and OSV-Scanner have NOT been executed: the sandbox allowlist blocks the Semgrep rule pack (`semgrep.dev` returned 403) and the other scanners are not installed. Hosted CI must run on the final frozen commit after credits return (30 Nov 2026). Consumer coverage is not automatic. |
| P1.3 - Weak default routing | Hardened resolver argument handling and prototype-property checks; expanded code-change baseline; added additive task-plus-keyword routing and regression tests. | Implemented. |
| P1.4 - Circular trust root | Added SECURITY-ROOT.md and updated CONSUMING.md to require an independently sourced full commit pin. | Partially addressed. No owner-controlled signed release identity or independently verifiable v1.0.0 artefact exists yet. |
| P1.5 - Repository protection and licensing | Added OWNER-ACTIONS.md and verified repository settings. | Owner action required. GitHub reports main is unprotected, no rulesets exist and no licence is published. |
| P2.6 - Weak M11 AI security | Added concrete agent/tool execution, approval binding, RAG isolation, memory, output validation, provider governance and adversarial test guidance. | Implemented as a supplement; M11 remains source-derived and unchanged. |
| P2.7 - Ambiguous severity classification | Added assurance/severity-classification.md with impact, reachability, blast-radius, uncertainty and CVSS context. | Implemented as supplemental decision guidance. |
| P2.8 - Control IDs not implemented | Replaced placeholder numeric ranges with one stable USS- family ID per module and added assurance/control-catalog.json. | PARTIALLY IMPLEMENTED. Module-family IDs plus `tools/requirement-ids.mjs`, which derives content-addressed statement IDs (`USS-XXX.<8 hex>`, 1,121 statements, uniqueness asserted, 4 regression tests in `tests/requirement-ids.test.mjs`). IDs detect wording changes but are not hand-numbered normative clauses; non-normative lines also receive IDs. |
| P2.9 - Weak validator | Added tools/validate-evidence.mjs, strict evidence/finding linkage, P0/P1 non-acceptance, time-bounded P2/P3 acceptance, catalog validation and CI tests. | Strengthened. It validates report structure and declared statuses, not the truth or completeness of submitted evidence. |
| P2.10 - M09 and stack profiles incomplete | Added data lifecycle/privacy guidance and Node.js/Express and Python/FastAPI reference profiles. | Supplemented. Both stack profiles remain explicitly NOT VERIFIED until tested against named consuming applications. |
| P3.11 - Repository bloat | No module consolidation or deletion was made because source traceability and task-loading behaviour must not be weakened without evidence. | Pending targeted size/usage analysis. |
| P3.12 - Broken Markdown | Added link checks for README, supplements and stack references. Canonical source formatting has not been rewritten. | Partially addressed. A targeted render audit of escaped formatting in source-derived modules remains. |
| P3.13 - Resolver prototype bug | Task lookup now uses own-property checks; inherited names such as constructor, toString and __proto__ are rejected. | Implemented with regression tests. |
| P3.14 - Tests depend on build order | Unit tests no longer require untracked dist/bundles output. CI still builds bundles before repository validation. | Implemented with clean-checkout tests. |
| P3.15 - Naming and consistency | Updated README, index, changelog, trust documentation and owner-action notes. | Partially addressed. The repository name seurity-layer may be a typo; rename is an owner decision because it affects URLs and consumers. |

## Owner-only blockers

See [OWNER-ACTIONS.md](OWNER-ACTIONS.md) for:
- branch protection and required human review;
- dependency graph access for GitHub Dependency Review;
- software licence selection;
- release signing identity and independent verification;
- optional repository rename.

## Verification rule

A finding is not closed because a document was added. Closure requires the independent reviewer to confirm the implementation, the evidence and any remaining limitations against the original finding. P0/P1 findings remain release blockers until resolved and verified.
