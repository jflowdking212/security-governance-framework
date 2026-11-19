# Changelog

## 1.0.0 - Release Candidate (v1.0.0-rc1)

- Unified integration of PR #3 (routing, evidence validation, security scanners) and PR #8 (trust root, checksum manifest, SSH signing).
- Replaced regex workflow tests with a structural AST YAML parser in `tests/workflow-security.test.mjs`, featuring 12 negative mutation tests rejecting all weakenings (dropped steps, `|| true`, `continue-on-error`, unsafe `pull_request_target`, unpinned actions, write permissions, and disabled scanners).
- Checksum verification security hardening in `tools/checksums.mjs`: detects and rejects non-default Git index flags (`assume-unchanged`, `skip-worktree`); validates disk bytes against committed HEAD blobs; preserves only root `.git` exclusion while hashing nested `.git`; eliminates silent top-level `dist/` exclusions in filesystem mode; adds 6 adversarial regression tests in `tests/checksums.test.mjs`.
- Completed comprehensive M06 security guidance: constant-time comparison (`crypto.timingSafeEqual`, `hash_equals`), raw payload signature verification, 300s timestamp replay tolerance, atomic idempotency with database unique constraints, PCI DSS SAD/PAN/CVV storage prohibitions, client-side tokenisation delegation, and error log redaction.
- Completed comprehensive M12 security guidance: untrusted fork PR protection, strict `pull_request_target` prohibitions, workflow context injection prevention via environment variables, untrusted branch/commit metadata sanitization, least-privilege `permissions: contents: read`, `persist-credentials: false`, and untrusted `workflow_run` artifact validation.
- Added technology-specific reference profiles for Laravel/PHP, React/TypeScript, and Flutter/Dart under `stacks/`, explicitly verified as unverified until evaluated against live applications.
- Implemented automated supplement routing in `manifest.json` and `tools/resolve-task.mjs`, adding `--supplement <id|slug|path>` support, disk path validation, duplicate suppression, and explicit `--strict` fail-closed mode.
- Pinned Semgrep container image in `.github/workflows/security-scans.yml` by immutable SHA256 digest (`semgrep/semgrep:1.186.0@sha256:25251de66c3b0fdea1c1c519bbc130170349f3da79edd517335b847f30d3c493`).
- Added pinned `yaml@2.9.1` dependencies (`package.json`, `package-lock.json`) with zero OSV vulnerabilities verified against OSV API.
- Updated `.github/CODEOWNERS` to assign ownership to `@jflowdking212` for `assurance/`, `supplements/`, `stacks/`, `templates/`, `OWNER-ACTIONS.md`, and `RELEASE-CHECKLIST.md`.
- Completed owner actions: PNCUL 1.0 licence published (PR #4), repository renamed to `security-governance-framework`, `Protect Main` ruleset (ID `27612394`) active, dependency graph enabled, and SSH release-signing identity established (`jude_m2003@yahoo.com`, `SHA256:zfXCAflnGbD1984rV8kabaPj92UyXIs0gCVsIspIX/o`).

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
- Added an evidence-based P0-P3 severity classification rubric aligned with M17 and CVSS v4 context.
- Added CI validation for the control catalog and example evidence report.
- Documented the external trust-root model, including the limits of self-validation and the need for independently pinned commits and verified signer identity.
- Added an owner-action register after verifying that main is unprotected, no repository rulesets exist, no licence is published and the dependency-graph comparison API returns HTTP 403.
- Added a correction log mapping the latest Claude findings to implementation evidence, remaining gaps and owner-only decisions.
- Added pinned Gitleaks, Semgrep, CodeQL and OSV-Scanner workflows for the USS repository. GitHub Dependency Review was tested but is deferred because the dependency-graph compare API returned HTTP 403.
- Added deterministic workflow tests that reject unpinned GitHub Actions and verify scanner fail-closed settings.
- Added a consumer CI security workflow template with explicit adaptation and repository-protection requirements.
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
