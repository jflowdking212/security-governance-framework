# Deterministic security enforcement

**Status:** Repository CI scanners and structured evidence validation are configured on the correction branch. Consuming applications must adapt the workflow to their own languages, frameworks, infrastructure and deployment risks.

## Enforcement layers

| Layer | Mechanism | What it checks | Important limitation |
|---|---|---|---|
| Source integrity | Module generator and validator | Source/archive equality, module generation, dependency graph, traceability and policy invariants | Does not authenticate the repository or prove that the source policy is complete |
| Routing | Resolver regression tests | Task closure, keyword routing, default code-change baseline and routing budget | A task can still be misclassified; agents must review unmatched-keyword warnings |
| Secret scanning | Gitleaks full-history scan | Exposed credential patterns in the repository history | A clean scan does not prove credentials were never exposed; confirmed leaks must be revoked/rotated |
| Static analysis | Semgrep open-source rules | Known code patterns and selected security/code-quality findings in repository tooling | Rules have false positives and false negatives; review coverage and exclusions |
| Semantic analysis | GitHub CodeQL | JavaScript/TypeScript code paths and supported vulnerability patterns | Only configured languages and analyzed code are covered |
| Dependency analysis | OSV-Scanner | Known vulnerabilities in supported dependency manifests and lockfiles | Unsupported or missing lockfiles reduce coverage; not a general code scanner |
| Pull-request dependency review | GitHub Dependency Review | Newly introduced dependencies and configured severity/license policy | Only dependency changes represented in the PR diff are assessed |
| Evidence integrity | USS evidence validator | Control-family IDs, status/evidence shape, finding linkage, P0/P1 blockers and documented P2/P3 acceptance | Validates the submitted record, not whether the evidence is true or complete |

## Repository workflow

The repository runs the following workflows:

- USS validation: deterministic generation, manifest/traceability validation, task routing, evidence-template validation and automated tests.
- USS security scans: full-history Gitleaks, Semgrep, CodeQL, OSV-Scanner and pull-request dependency review.

External GitHub Actions are pinned to full commit SHAs. Semgrep runs from an exact versioned container tag. Review and update these pins deliberately, not automatically.

The scanners run against this repository's own source. They do not scan a consuming application's code, infrastructure or production environment merely because that application reads USS.

## Consuming application requirements

A consuming project should adapt the security workflow to include the languages and artifacts it actually deploys. Depending on the stack and threat model, this may include:

- SAST and language-specific CodeQL/Semgrep rules.
- Secret scanning across the full Git history.
- Dependency and license review for every package ecosystem and lockfile.
- Container image and infrastructure-as-code scanning.
- SBOM generation, provenance and artifact signing.
- DAST, API security tests, authorization tests and webhook negative tests.
- Backup restoration, disaster recovery and production configuration checks.

A scanner that does not support a file format or language must be reported as NOT COVERED, not PASS. A failed or skipped required scanner must fail the release gate or be recorded as an unresolved control.

## Triage and release behaviour

- P0/P1 findings remain non-waivable production-release blockers.
- P2/P3 findings may use the documented owner-approved risk-acceptance process, with rationale, approver and expiry.
- Do not suppress findings only to make CI green. Record the rule, location, evidence, rationale, compensating control and expiry for a justified exception.
- Scanner output must be reviewed for exploitability, reachability, affected environment and business impact. CVSS labels are triage signals, not automatic USS severity assignments.
- A passing scanner is one evidence item. It is not a security certification or proof of production readiness.

## Current coverage limits

The USS repository itself is a Node.js tooling and documentation repository. The current workflow covers JavaScript/TypeScript tooling, repository secrets, dependency manifests and generic Semgrep rules. It does not claim coverage for a consuming project's Python, PHP, Java, Go, .NET, mobile, Terraform, Kubernetes, container images, cloud IAM, running APIs or production environment. Add and verify the relevant scanners in the consuming application.
