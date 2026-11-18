# Changelog

## Unreleased - Claude review correction series

- Hardened task resolution against inherited JavaScript object properties, malformed arguments and duplicate selectors.
- Added additive task-plus-keyword routing so the general code-change baseline can be widened to specialist security domains.
- Expanded the default code-change route to include general input/client, API, secrets, data-integrity and supply-chain controls while remaining below the routine routing budget.
- Removed the clean-checkout test dependency on generated, untracked full-text bundles; tracked task indexes remain covered by unit tests and generated bundle validation remains in CI.
- Made resolver, routing, manifest and documentation tests independent of the caller's working directory.
- Added supplemental implementation guidance for OAuth/OIDC/JWT, SSRF, GraphQL/WebSocket/gRPC, cryptographic storage, data lifecycle/privacy, AI agent/tool/RAG security and container/cloud runtime.
- Added Node.js/Express and Python/FastAPI reference profiles, explicitly marked unverified until tested against named consuming applications.
- Replaced placeholder control-ID ranges with a machine-readable module-family catalog covering all 22 modules.
- Added a deterministic evidence validator for scoped control status, evidence references, finding linkage, P0/P1 blockers and time-bounded P2/P3 risk acceptance.
- Added CI validation for the control catalog and example evidence report.
- Documented the external trust-root model, including the limits of self-validation and the need for independently pinned commits and verified signer identity.
- Added pinned Gitleaks, Semgrep, CodeQL and OSV-Scanner workflows for the USS repository. GitHub Dependency Review was tested but is deferred because the dependency-graph compare API returned HTTP 403.
- Added deterministic workflow tests that reject unpinned GitHub Actions and verify scanner fail-closed settings.
- Added regression tests for prototype-property task names, malformed CLI arguments, additive routing and baseline module coverage.

## 1.0.0 - review-ready candidate

- Reorganised the canonical global directive and payment/tax supplement into 22 task-focused modules.
- Preserved original source documents verbatim in `source/original-directives/`.
- Added source-section references and a traceability matrix covering global sections 1-21, payment/webhook/tax requirements, and the Anti-Gravity execution contract.
- Added task routing, dependency resolution and on-demand bundle compilation.
- Added a short kernel and agent entrypoint.
- Clarified the owner-approved policy: P0/P1 are non-waivable production-release blockers; risk acceptance applies only to P2/P3.
- Added validation, tests and CI enforcement.
- Expanded the root README with project overview, quick start, task catalogue, validation and release guidance.
- Added private vulnerability reporting guidance, contribution standards, repository ignore rules and a pull-request template.
- Added README link validation and documentation tests.
- Independent review corrections: mandatory M13 self-audit reachable from every task; P0/P1 source 19.8 exception explicitly superseded in M20; domain-local 13-layer checks; payment preamble; leaner task routing; exact keyword matching; generated indexes; line-level source coverage and structural/routing checks; pinned consuming guidance; CI hardening.
- This candidate remains subject to independent Claude review before final release/tagging.
