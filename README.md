# Universal Security Standard (USS)

**Current version:** 1.0.0  
**Release status:** Independent review completed with required fixes applied; GitHub Actions CI passes on Node.js 20 (34 tests); final owner release approval remains.  
**Security posture:** FAIL CLOSED & PROVE  
**Runtime requirement:** Node.js 20 or later for the repository validation tools. No third-party Node packages are required.

[![USS validation](https://github.com/jflowdking212/seurity-layer/actions/workflows/uss-validation.yml/badge.svg?branch=uss%2Fv1.0.0-modular-security-standard)](https://github.com/jflowdking212/seurity-layer/actions/workflows/uss-validation.yml)

USS is a modular, source-traceable security engineering standard for human developers and AI coding agents. It turns the project's canonical application-security, payment/webhook/tax and agent-execution directives into focused modules that can be selected by task. The aim is to make the right security requirements available at the point of work without forcing every agent to load the entire policy library.

> **Important:** v1.0.0 has received an independent Claude review. The required correction series is being applied and must pass GitHub CI and owner approval before it is treated as an approved production standard.

## What USS provides

- A short mandatory security kernel and agent entrypoint.
- 22 focused security modules with declared source references and dependencies.
- Task routing for authentication, authorisation, input security, APIs, payments, tax, secrets, data protection, operations, AI/LLM, supply chain, audits and other security work.
- A 13-Layer Security Assurance Model for structured security assessment.
- A source-to-module traceability matrix and preserved canonical source documents.
- Task resolution and on-demand bundle generation.
- Automated checks for source preservation, module consistency, dependency integrity, release-policy invariants and tests.
- Short adapters for Gemini, Claude and ChatGPT.

USS is a policy and verification framework. It does not automatically secure an application, replace application-specific engineering, or constitute an external certification.

## Start here

For an AI agent or developer entering a repository that uses USS:

1. Read [AGENTS.md](AGENTS.md).
2. Read [KERNEL.md](KERNEL.md).
3. Find the task in [MODULE-INDEX.md](MODULE-INDEX.md) or `manifest.json`.
4. Follow [CONSUMING.md](CONSUMING.md) to pin and vendor the exact reviewed USS commit.
5. Resolve the task and its transitive dependencies.
6. Read the returned modules before changing security-relevant code.
7. Verify controls against the actual application and report evidence. Do not mark an unknown control as passed.

### Resolve a task

Run from the repository root:

```sh
node tools/resolve-task.mjs --task authentication
node tools/resolve-task.mjs --task payments
node tools/resolve-task.mjs --task saas-tenancy
node tools/resolve-task.mjs --task full-audit
```

You can also resolve one module and its dependencies:

```sh
node tools/resolve-task.mjs --module M03
```

Or search module trigger terms:

```sh
node tools/resolve-task.mjs --keywords "payment webhook"
```

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
| `AGENTS.md`, `KERNEL.md` | Mandatory agent entrypoint and concise security rules |
| `manifest.json`, `MODULE-INDEX.md` | Module metadata, triggers, tasks and dependency graph |
| `modules/` | 22 source-derived security modules |
| `bundles/` | Compact task indexes showing which modules to load |
| `tools/` | Module generator, task resolver, bundle builder and validator |
| `assurance/` | Assurance model, audit lifecycle, control registry and reporting guidance |
| `source/original-directives/` | Preserved canonical source documents |
| `source/traceability-matrix.csv` | Source-section to module mapping |
| `adapters/` | Gemini, Claude and ChatGPT entrypoints |
| `stacks/` | Stack-specific profile guidance; no stack profile is currently claimed as verified |
| `templates/` | Audit and remediation templates |
| `tests/` | Automated manifest and task-resolver tests |
| `.github/workflows/` | Continuous validation workflow |

## Build and validate

Requirements: Node.js 20 or later. The tools use Node.js built-ins and do not require installing third-party packages.

From a clean checkout:

```sh
# Regenerate all modules from the preserved canonical sources
node tools/build-modules.mjs

# Confirm generated modules are reproducible and unchanged
git diff --exit-code -- modules/

# Compile the configured task bundles into dist/bundles/
node tools/build-bundles.mjs

# Run source, manifest, dependency and policy validation
node tools/validate.mjs

# Run the automated test suite
node --test tests/*.test.mjs
```

To compile one task bundle only:

```sh
node tools/build-bundles.mjs --task payments
```

Generated full-text bundles are written to `dist/bundles/` and are local build artefacts. They are not a substitute for reading the source modules.

GitHub Actions runs the module generator, checks for stale generated modules, compiles bundles, runs validation and executes the tests on pushes and pull requests.

## Core release rules

- **P0 (Critical) and P1 (High) findings block production release.**
- No agent, developer or operator may waive, downgrade or silently accept a P0/P1 finding.
- Risk acceptance applies only to P2/P3 findings, following the required documented process.
- Unknown, untested or unsupported is not PASS.
- A passing build, scanner, test suite or AI review alone does not prove production security.
- Destructive changes, production migrations, credential revocation/rotation and production deployment require explicit human authorisation.
- Security claims must be supported by relevant evidence.

See [M17](modules/m17-severity-release-gates.md), [M20](modules/m20-audit-first-remediation.md) and [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md).

## Source integrity and policy changes

The original directives are retained at the repository root and under `source/original-directives/`. Their archived copies are checked against the root copies by the validator.

Generated modules must be rebuilt with `tools/build-modules.mjs`; do not hand-edit generated module text. A proposed change to universal policy must be reviewed against the canonical sources, traceability matrix, module dependencies, tests and version history. Project-specific profiles may strengthen USS but must not weaken it.

See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes. See [CONSUMING.md](CONSUMING.md) for pinning, vendoring and safe update procedures.

## Independent review and release status

The v1.0.0 candidate is under independent review. The review instructions and report are:

- [Claude review instructions](REVIEW-PROMPT-FOR-CLAUDE.md)
- [Claude review report](REVIEW-CLAUDE.md)
- [Release checklist](RELEASE-CHECKLIST.md)
- [Changelog](CHANGELOG.md)

The candidate must not be merged or tagged as an approved release until the independent review is complete, required findings are resolved or explicitly documented, and the owner approves the final result.

## Security reporting

Please do not publish vulnerability details, credentials, exploit instructions or sensitive application data in a public issue. See [SECURITY.md](SECURITY.md) for the private reporting process.

## License and reuse

No license has been added to this repository. Public visibility does not by itself grant permission to copy, modify, redistribute or incorporate this material into another product. Obtain permission from the repository owner before reuse until a license is explicitly published.
