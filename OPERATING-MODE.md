# USS Operational Mode and Continuous Improvement

**Operating state:** ACTIVE, owner-authorised provisional baseline  
**Baseline version:** 1.0.0-rc.1  
**Official repository:** https://github.com/jflowdking212/security-governance-framework  
**Pinned commit:** 1bb8a6ef04006b0030c989ca8029f2a0d4f70407  
**Validation run:** https://github.com/jflowdking212/security-governance-framework/actions/runs/45577716158  
**Security scans:** https://github.com/jflowdking212/security-governance-framework/actions/runs/45577716565  
**Formal signed release:** Pending owner signing ceremony

## 1. Operating decision

USS is the active initial security baseline for authorised Jay Bliss Tech projects. It is not being held back until every enhancement is complete. Projects must begin using its task-routing, secure-engineering, evidence and release-gate requirements immediately.

This activation does not claim that USS is perfect, that consuming applications are secure, or that the provisional commit is a cryptographically signed release. It establishes a controlled baseline that can be measured and improved.

## 2. Provisional trust state

Until the signed v1.0.0 release is published, consuming projects must use the owner-authorised provisional procedure in CONSUMING.md.

Every consuming repository must pin:
- Exact repository URL and 40-character commit SHA.
- trust_mode=owner-authorised-provisional.
- release_signed=false.
- Version and hosted validation/security-scan run references.
- Project owner approval reference and adoption date.

The pin must be stored in a protected .uss-version file. Agents must never consume a mutable branch or silently update the pin. Reports must state PROVISIONAL / OWNER-AUTHORISED / UNSIGNED.

## 3. Adoption model

Adopt USS in three practical layers. Do not wait for a full application audit before applying the baseline to new work.

### Layer A: Immediate engineering use

- Add the USS agent entrypoint to each consuming repository.
- Require every AI agent and human contributor to read the pinned AGENTS.md and KERNEL.md before security-relevant work.
- Route each task through tools/resolve-task.mjs and load the selected module plus all declared dependencies.
- Use code-change as the default baseline and add task keywords for payments, tenancy, AI, secrets, databases, APIs, infrastructure and other boundaries.
- Require the USS completion report: pinned version/commit, task and modules, controls changed, tests/evidence, unresolved risks and rollback implications.

### Layer B: Repository controls

- Install the consumer security workflow from templates/ci/consumer-security-scans.yml.
- Validate the copied workflow with tools/validate-consumer-workflow.mjs.
- Keep actions pinned to full commit SHAs and container images pinned by digest.
- Protect workflow files, .uss-version, AGENTS.md, KERNEL.md, security policy and release configuration.
- Run repository validation, tests, secret scanning, SAST, dependency scanning and CodeQL where supported.
- Treat unsupported scanners or missing platform capabilities as UNKNOWN, never PASS.

### Layer C: Application assurance

- Create a project-specific evidence file from templates/security-evidence.example.json.
- Assess controls relevant to the application's current scope for routine operational reviews; use all 22 control families and all 13 assurance layers for a formal full audit or production-release assessment.
- Record each control as PASS, FAIL or UNKNOWN with concrete evidence. A control is not PASS because a document exists or a test was written.
- Record findings with severity, reproduction, affected asset, owner, remediation target and retest evidence.
- Run tools/validate-evidence.mjs on the evidence file. READY_FOR_OWNER_REVIEW is not owner approval or production certification.

## 4. Assurance Pulse: strengths and weaknesses

The operational feedback loop is the Assurance Pulse. Each project produces a machine-readable evidence report and a concise human-readable summary. The portfolio view must compare projects without hiding unknowns.

Track these measures per project and over time:

| Measure | What it tells us |
|---|---|
| Control coverage | Number of in-scope controls assessed versus UNKNOWN |
| Verified strengths | PASS controls backed by current, relevant evidence |
| Defects | FAIL controls and linked P0-P3 findings |
| Critical exposure | Open P0/P1 findings and affected production boundaries |
| Evidence freshness | Age of evidence and controls that need retesting |
| Scanner health | Whether required scanners ran, what they covered and whether they found issues |
| Remediation speed | Time from finding creation to verified closure |
| Repeat weaknesses | Findings recurring after a previous fix or appearing across multiple projects |
| Change impact | New findings, regressions and controls affected by each release |
| Drift | Projects pinned to outdated USS versions or missing required policy/workflow files |

Do not compress the result into a single percentage that can hide critical failures. Show PASS, FAIL and UNKNOWN separately. A high pass rate never offsets an open P0/P1.

### Minimum report shape

Each project's report should include:
- Repository and exact application commit assessed.
- USS version, exact pinned USS commit and trust state.
- Assessment date, scope and assessor identity.
- Control IDs with PASS/FAIL/UNKNOWN and evidence references.
- Findings with severity, status, owner, target date and retest.
- CI/security scan run IDs, tool versions, target coverage and result.
- New, closed, recurring and overdue findings since the previous assessment.
- Residual risk and deployment/rollback implications.

Keep reports free of secrets, tokens, personal data and exploitable production details. Store detailed evidence in access-controlled locations and publish only the minimum safe summary to GitHub.

## 5. Operating cadence

- Every pull request: task-routed USS review, required tests, applicable security scans and concise completion report.
- Daily: automated CI/security scan status and new high-severity finding review where the repository supports scheduled runs.
- Weekly: compare Assurance Pulse reports across active projects; identify repeated weaknesses, stale evidence, overdue findings and common architecture gaps.
- Every USS update: pin the new exact commit, inspect the policy/tooling diff, run validation and security scans, and roll forward through a reviewed PR. Never silently auto-update consumers.
- After an incident or material architecture change: reassess affected control families and update evidence.

## 6. Severity and response rules

- P0/P1 findings block the affected production release or change. Escalate immediately; do not waive, downgrade or silently accept them.
- P2/P3 findings receive an owner, target date, documented rationale and retest plan. Risk acceptance is limited to the USS-defined process.
- UNKNOWN means not demonstrated. It is a work item, not a pass.
- Existing production services are not automatically certified by adopting USS. Apply the controls to new changes immediately and assess the existing attack surface in a prioritised baseline review.
- A passing USS repository CI run validates the USS library and tooling, not the security of SafeSellz, SMMTAI, Choir or any other consuming application.

## 7. First adoption order

1. SafeSellz AI: payment, escrow, webhook, identity, tenancy and financial-release boundaries. Prioritise M02, M03, M04, M05, M06, M08, M09, M10, M12, M17, M19 and M22 as applicable.
2. SMMTAI: production SaaS, multi-tenancy, social-provider credentials, AI generation, publishing queues, webhooks and operational resilience. Prioritise M02-M05, M08-M12 and M22 as applicable.
3. Choir: SaaS identity, tenant isolation, AI/agent execution, secrets, data lifecycle, deployment and operational controls. Prioritise M02-M05 and M08-M13, M22 as applicable.

The order prioritises high-consequence boundaries; it does not defer baseline use in the other repositories. All three should receive the agent entrypoint and pin before their next security-relevant engineering change.

## 8. Update and improvement policy

The initial baseline is expected to improve. Every improvement must be traceable to one or more of:
- A verified finding or incident.
- A control that repeatedly fails or remains UNKNOWN.
- A test or scanner coverage gap.
- A new technology, threat or regulatory requirement.
- Operational feedback from a consuming project.

Each update must include the observed weakness, affected projects, proposed change, compatibility impact, tests, rollback plan and exact new USS commit. Improvements are released sequentially. Consumers update through reviewed pull requests and keep their previous known-good pin for rollback.

## 9. Current limitations

- The signed v1.0.0 tag and signed checksum manifest are not yet published.
- The provisional trust mode is owner-authorised but not cryptographically equivalent to the signed release procedure.
- The eight stack profiles are reference-only and require validation against each consuming application's actual framework and configuration.
- No consuming application is automatically assessed or certified by this activation.
- The initial Assurance Pulse is a reporting process until each repository has its evidence file and workflow wired.

These limitations are visible work items, not reasons to keep USS unused.
