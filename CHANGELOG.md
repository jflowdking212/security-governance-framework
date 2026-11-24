# Changelog

## 1.0.0-rc.1 - Independent Audit Remediation Release Candidate (2026-11-20)

- **Evidence Validator (U-02):** Hardened `tools/validate-evidence.mjs` with a closed allowlist for evidence results (`SUCCESS_RESULTS` vs `FAILURE_RESULTS`), structural rejection of PASS controls backed by failed or non-success evidence, rejection of placeholder references (`n/a`, `none`, `unknown`, `tbd`, `-`), rejection of future assessment and evidence dates, and temporal consistency checks (evidence observation cannot post-date assessment). Added 6 regression tests in `tests/evidence.test.mjs`.
- **Workflow Security (U-03):** Added `timeout-minutes: 15` across runner jobs in `.github/workflows/security-scans.yml`. Added structural AST checks and 5 negative mutation tests in `tests/workflow-security.test.mjs` verifying rejection of: (1) direct `github.event` shell interpolation, (2) unapproved `workflow_run` triggers, (3) replacement of `npm ci` with `npm install`, (4) removal of `--ignore-scripts`, and (5) missing job timeouts.
- **Checksum Hardening (U-04):** Hardened `tools/checksums.mjs` to detect and reject nested `.git` directories in Git mode, reject active `.git/hooks` in filesystem mode, and prohibit any `.git` component in release paths. Added 3 regression tests in `tests/checksums.test.mjs`.
- **Scanner Drift & Commit Provenance (U-05):** Updated Gitleaks job name in `.github/workflows/security-scans.yml` to accurately state commit range scan on push/PR and full history on schedule. Expanded Semgrep scan scope to `tools/ tests/`. Verified official provenance of OSV commit pin `d3c1414ded37de590f207572e37a7d180f1d0ef7` and documented in `SECURITY-ROOT.md`.
- **Clean Checkout Documentation (U-06):** Documented `npm ci --ignore-scripts` requirement across `README.md`, `CONSUMING.md`, `RELEASE-CHECKLIST.md`, and `CONTRIBUTING.md`, clarifying that core tools require zero dependencies and explaining the security purpose of `--ignore-scripts`.
- **Module Traceability (U-07):** Added `## USS implementation guidance: ...` prefixes and explanatory blockquotes to all supplemental sections in `tools/build-modules.mjs` (M06, M12, M21). Updated M06 webhook replay protection to specify verification of provider-signed timestamps where supplied without incorrectly requiring a separate header from all providers. Added W3C Private Network Access (PNA) guidance to M21. Regenerated all modules with zero drift.
- **Task Resolver & Stack Profiles (U-10):** Updated `tools/resolve-task.mjs` to fail closed with exit code 2 when invoked without arguments. Added stack profile routing (`--stack <name>`). Created reference profiles for Go (`stacks/go.md`), Rust (`stacks/rust.md`), and Java/Spring Boot (`stacks/java-spring.md`), marked REFERENCE ONLY. Added `"stacks"` catalog to `manifest.json`.
- **Licensing & Supply Chain (U-10):** Added `"license": "SEE LICENSE IN LICENSE"` and `"author"` to `package.json`. Created `THIRD-PARTY-NOTICES.md` documenting `yaml@2.9.1` under ISC License. Added `namespaces="git,USS-SHA256SUMS"` to `.security/allowed_signers` and documented domain separation in `SECURITY-ROOT.md`. Expanded `.github/CODEOWNERS` for complete repository coverage.
- **Candidate Status:** Version set to `1.0.0-rc.1` across `VERSION`, `package.json`, `manifest.json`, `templates/security-evidence.example.json`, and documentation. Final official `v1.0.0` release tag and cryptographic signing ceremony await owner execution.

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
