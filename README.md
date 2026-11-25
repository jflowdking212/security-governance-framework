# Universal Security Standard (USS)

**Current version:** 1.0.0 (unreleased — awaiting owner cryptographic signing & publication)
**Operating status:** ACTIVE on `main` at commit `f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda` (PR #14 merged); `Protect Main` ruleset (ID `27612394`) enforces pull requests, review-thread resolution, `0` required human approvals, and all five mandatory GitHub Actions status checks.
**Release status:** Unsigned `1.0.0` release metadata is prepared on branch `release/v1.0.0`. The formal signed `v1.0.0` release commit, `SHA256SUMS.sig`, annotated `v1.0.0` tag, and GitHub Release publication remain pending owner execution. Until the signed release is published, follow the provisional trust procedure in [OPERATING-MODE.md](OPERATING-MODE.md).
**Security posture:** FAIL CLOSED & PROVE
**Runtime requirement:** Node.js 20 or later. Core repository tools require zero external dependencies; test suites require `npm ci --ignore-scripts`.

[![USS validation](https://github.com/jflowdking212/security-governance-framework/actions/workflows/uss-validation.yml/badge.svg?branch=main)](https://github.com/jflowdking212/security-governance-framework/actions/workflows/uss-validation.yml)

USS is a modular, source-traceable security engineering standard for human developers and AI coding agents. It turns the project's canonical application-security, payment/webhook/tax and agent-execution directives into focused modules that can be selected by task. The aim is to make the right security requirements available at the point of work without forcing every agent to load the entire policy library.

> **Operational use:** USS is now the active initial security baseline for authorised Jay Bliss Tech projects. It is not a certification or a claim that every consuming application is secure. Existing application controls must be assessed in each repository; unknown controls remain UNKNOWN, and P0/P1 findings remain release blockers. The formal signed release is still pending.

## What USS provides

- A short mandatory security kernel and agent entrypoint.
- Technology-specific implementation supplements for identity, SSRF, API protocols, cryptography, data lifecycle, AI agents/RAG and container/cloud runtime.
- 22 focused security modules with declared source references and dependencies.
- Task routing for authentication, authorisation, input security, APIs, payments, tax, secrets, data protection, operations, AI/LLM, supply chain, audits and other security work.
- A 13-Layer Security Assurance Model for structured security assessment.
- A source-to-module traceability matrix and preserved canonical source documents.
- Task resolution and on-demand bundle generation.
- A machine-readable control-family catalog and structured evidence validator with non-waivable P0/P1 release gates.
- An explicit external trust-root model that explains what repository validation can and cannot authenticate.
- Automated CI scans using Gitleaks, Semgrep, CodeQL and OSV-Scanner. GitHub Dependency Review remains optional pending dependency-graph API access.
- Automated checks for source preservation, module consistency, dependency integrity, release-policy invariants and tests.
- Short adapters for Gemini, Claude and ChatGPT.

USS is a policy and verification framework. It does not automatically secure an application, replace application-specific engineering, or constitute an external certification.

## Verify integrity before use

USS is security policy and must be treated as a security-critical dependency. Use the signed-release trust bootstrap when the signed release is available. Until then, owner-authorised projects may use the exact pinned commit only under the provisional trust procedure in OPERATING-MODE.md and CONSUMING.md. Provisional use must be explicitly recorded; it is not cryptographic release verification.

The current owner signing-key fingerprint and verification procedure are documented in [SECURITY-ROOT.md](SECURITY-ROOT.md). The signed release manifest and tag remain outstanding; do not describe the provisional baseline as a signed release.

## Start here

For an AI agent or developer entering a repository that uses USS:

1. Read [AGENTS.md](AGENTS.md).
2. Read [KERNEL.md](KERNEL.md).
3. Find the task in [MODULE-INDEX.md](MODULE-INDEX.md) or `manifest.json`.
4. Follow [OPERATING-MODE.md](OPERATING-MODE.md) and [CONSUMING.md](CONSUMING.md) to pin the exact owner-authorised commit in provisional mode or the signed release when available.
5. Resolve the task and its transitive dependencies.
6. Read the returned modules before changing security-relevant code.
7. Read relevant implementation supplements from [supplements/README.md](supplements/README.md) when the application uses the technology or boundary they cover.
8. Verify controls against the actual application and report evidence. Do not mark an unknown control as passed.

### Resolve a task

Run from the repository root:

```sh
node tools/resolve-task.mjs --task authentication
node tools/resolve-task.mjs --task payments
node tools/resolve-task.mjs --task saas-tenancy
node tools/resolve-task.mjs --task full-audit

# General code changes use a secure baseline plus the relevant domain triggers
node tools/resolve-task.mjs --task code-change --keywords "database"
node tools/resolve-task.mjs --task code-change --keywords "payment webhook"
```

You can also resolve one module and its dependencies:

```sh
node tools/resolve-task.mjs --module M03
```

Or search module trigger terms:

```sh
node tools/resolve-task.mjs --keywords "payment webhook"
```

Task and keyword routing can be combined. `code-change` loads the general secure-coding baseline (core workflow, input/client security, API hygiene, secrets, data integrity and supply-chain controls). Add `--keywords` to load specialist modules for the actual change. For example, use `--task code-change --keywords "payment webhook"` for payment-related work. Unmatched keywords are reported and must be reviewed rather than ignored.

The resolver prints the exact module paths and dependency order. Dependencies are mandatory, not optional suggestions.

## Task catalogue

| Task | Use it for |
|---|---|
| `authentication` | Login, credentials, MFA, recovery and sessions |
| `authorization` | Roles, permissions, object access and ownership |
| `input-security` | Validation, injection, encoding and file handling |
| `api-security` | API and browser cross-origin security |
| `payments` | Payment flows, webhooks and financial release gates |
| `tax-compliance` | Tax and indirect-tax controls |
| `secrets` | Secrets, credentials, rotation and revocation |
| `data-protection` | Privacy, data handling, retention and residency |
| `operations` | Logging, monitoring, errors and incident response |
| `ai-security` | AI/LLM and agent security |
| `supply-chain-cicd` | CI/CD, dependencies and software supply chain |
| `security-audit` | Assurance, self-audit, testing and remediation |
| `public-security-communication` | External security statements and disclosures |
| `agent-execution` | AI agent operating contract |
| `code-change` | General code changes and review |
| `frontend` | Browser and frontend security |
| `database` | Database, schema and transaction integrity |
| `production-release` | Full 22-module production release assessment |
| `saas-tenancy` | SaaS tenant boundaries and identity/authorisation |
| `full-audit` | All 22 modules and all 13 assurance layers |

The authoritative routing and dependency map is in [manifest.json](manifest.json).

## Repository structure

| Path | Purpose |
|---|---|
| `AGENTS.md`, `KERNEL.md`, `SECURITY-ROOT.md`, `OWNER-ACTIONS.md` | Agent entrypoint, security rules, external trust model and owner-only release decisions |
| `manifest.json`, `MODULE-INDEX.md` | Module metadata, triggers, tasks and dependency graph |
| `modules/` | 22 source-derived security modules |
| `bundles/` | Compact task indexes showing which modules to load |
| `tools/` | Module generator, task resolver, bundle builder, repository validator and structured evidence validator |
| `assurance/` | Assurance model, audit lifecycle, machine-readable control catalog, severity rubric, deterministic enforcement guidance, registry and reporting |
| `source/original-directives/` | Preserved canonical source documents |
| `source/traceability-matrix.csv` | Source-section to module mapping |
| `adapters/` | Gemini, Claude and ChatGPT entrypoints |
| `supplements/` | Supplemental implementation guidance for identity, SSRF, API protocols, cryptography, data lifecycle, AI agents/RAG and runtime hardening |
| `stacks/` | Eight reference profiles: Node.js/Express, Python/FastAPI, Laravel/PHP, React/TypeScript, Flutter/Dart, Go, Rust, and Java/Spring Boot; all remain reference-only and are not verified against a consuming application |
| `templates/` | Audit, remediation, structured security-evidence and consumer CI security workflow templates |
| `tests/` | Automated manifest, routing, documentation, evidence-validator and workflow-security tests |
| `.github/workflows/` | USS validation and security-scanning workflows |

## Build and validate

Requirements: Node.js 20 or later.

> **Dependency and Supply-Chain Security:**
> - Core USS tools (`tools/resolve-task.mjs`, `tools/checksums.mjs`, `tools/build-modules.mjs`, `tools/validate.mjs`, `tools/validate-evidence.mjs`) use Node.js standard library built-ins with zero external dependencies.
> - A single pinned dependency (`yaml@2.9.1`) is required strictly for running workflow AST security tests in `tests/workflow-security.test.mjs`.
> - The `--ignore-scripts` flag is mandatory during installation to prevent malicious third-party lifecycle scripts from executing arbitrary code during `npm ci`.

From a clean checkout:

```sh
# Install pinned test dependency without executing lifecycle scripts
npm ci --ignore-scripts

# Regenerate all modules from the preserved canonical sources
node tools/build-modules.mjs

# Confirm generated modules are reproducible and unchanged
git diff --exit-code -- modules/

# Compile the configured task bundles into dist/bundles/
node tools/build-bundles.mjs

# Run source, manifest, dependency and policy validation
node tools/validate.mjs

# Validate the control catalog and example evidence report
node tools/validate-evidence.mjs --file templates/security-evidence.example.json

# Run the automated test suite
node --test tests/*.test.mjs
```

To compile one task bundle only:

```sh
node tools/build-bundles.mjs --task payments
```

Generated full-text bundles are written to `dist/bundles/` and are local build artefacts. They are not a substitute for reading the source modules.

GitHub Actions runs the module generator, checks for stale generated modules, compiles bundles, runs validation and tests, and performs secret, static-analysis, CodeQL and dependency scans. See [deterministic enforcement](assurance/deterministic-enforcement.md) for scope and limitations.

## Release integrity tooling

The deterministic checksum tool creates and verifies a SHA-256 manifest for the exact release file set:

```sh
node tools/checksums.mjs create
node tools/checksums.mjs verify
node tools/checksums.mjs create --root dist/bundles --filesystem
node tools/checksums.mjs verify --root dist/bundles --filesystem
```

Commit all intended release source files before creating the source manifest. In Git mode, the tool hashes canonical committed Git blob bytes, so Windows line-ending conversion does not change the digest. The first manifest covers Git-tracked source files. The second covers generated task bundles, which are not committed to Git. For a vendored subtree, use `--root vendor/uss`. Verify the detached SSH signature on `SHA256SUMS` with the independently trusted key fingerprint before trusting the manifest or running the checksum verifier. See [SECURITY-ROOT.md](SECURITY-ROOT.md).

## Core release rules

- **P0 (Critical) and P1 (High) findings block production release.**
- No agent, developer or operator may waive, downgrade or silently accept a P0/P1 finding.
- Risk acceptance applies only to P2/P3 findings, following the required documented process.
- Unknown, untested or unsupported is not PASS.
- A passing build, scanner, test suite or AI review alone does not prove production security.
- Destructive changes, production migrations, credential revocation/rotation and production deployment require explicit human authorisation.
- Security claims must be supported by relevant evidence.
- Formal release-readiness evidence must use the control catalog and pass `node tools/validate-evidence.mjs --file <assessment.json> --release --expected-commit <40-character-audited-commit-sha>`; this validator does not replace human owner approval.

See [M17](modules/m17-severity-release-gates.md), the [severity classification rubric](assurance/severity-classification.md), [M20](modules/m20-audit-first-remediation.md) and [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md).

## Source integrity and policy changes

The original directives are retained at the repository root and under `source/original-directives/`. Their archived copies are checked against the root copies by the validator.

Generated modules must be rebuilt with `tools/build-modules.mjs`; do not hand-edit generated module text. A proposed change to universal policy must be reviewed against the canonical sources, traceability matrix, module dependencies, tests and version history. Project-specific profiles may strengthen USS but must not weaken it.

See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes. See [CONSUMING.md](CONSUMING.md) and [SECURITY-ROOT.md](SECURITY-ROOT.md) for independent pinning, vendoring, trust and safe update procedures.

## Independent review and release status

PR #14 (`fb18d09581813e8213314cdbc611041bd70ea1bd`, closing Claude's November 25 findings F-1 through F-7) has merged into `main` at commit `f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda`, and `Protect Main` ruleset `ID 27612394` enforces all five mandatory GitHub Actions check contexts. Branch `release/v1.0.0` holds unsigned `1.0.0` preparation awaiting owner cryptographic signing (`U-01`); USS is not yet formally signed or released. These records preserve the review and release trail:

- [Initial Claude review instructions](REVIEW-PROMPT-FOR-CLAUDE.md)
- [Initial Claude review report (2026-11-18)](REVIEW-CLAUDE.md)
- [Independent audit and remediation log (2026-11-20 to 2026-11-25)](REVIEW-CORRECTION-LOG.md)
- [Release checklist](RELEASE-CHECKLIST.md)
- [Owner actions required before release](OWNER-ACTIONS.md)
- [Changelog](CHANGELOG.md)

The release remains unsigned and unmerged for final `v1.0.0` until the owner executes the workstation signing ceremony on `release/v1.0.0`, merges the signed-manifest PR into `main`, and publishes the signed `v1.0.0` tag and GitHub Release.

## Security reporting

Please do not publish vulnerability details, credentials, exploit instructions or sensitive application data in a public issue. See [SECURITY.md](SECURITY.md) for the private reporting process.

## License and reuse

This repository is public but is **not open source under an OSI-approved licence**. The software and materials owned by the Rights Holders are provided under the [Personal Non-Commercial Use Licence (PNCUL) 1.0](LICENSE).

- Personal, private, non-commercial use is permitted.
- Private modifications for your own non-commercial use are permitted.
- Commercial use, resale, paid services, sublicensing and redistribution of copies or modified versions are not permitted without prior written permission.
- Copyright and attribution must be retained: **Jude O. Richard and Jay Bliss Tech Limited**.

Public visibility does not grant commercial rights. GitHub's Terms of Service do permit users to view and fork public repositories within GitHub; the licence does not override those platform-specific permissions. Those permissions do not grant commercial-use rights or broader redistribution rights outside GitHub. Third-party materials remain subject to their own licence terms. For commercial licensing, contact the Rights Holders through the repository owner.

The licence is a custom source-available, non-commercial licence. It is not an OSI-approved open-source licence. See [LICENSE](LICENSE) for the complete terms.
