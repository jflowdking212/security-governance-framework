# M20 Audit-first, risk-prioritised engineering and remediation

**Source sections:** GLOBAL:19, GLOBAL:19.8-superseded-in-part, OWNER:RELEASE-POLICY  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**## 19. Audit-First, Risk-Prioritized Engineering & Remediation Control**



A functioning prototype is not evidence of production engineering completeness. Feature success proves only that the implemented happy path can work under the conditions tested.

Before repeatedly reacting to newly discovered defects, security advice, videos, isolated bugs, or the latest visible failure, establish the system's broader risk picture and manage remediation through a controlled engineering process.



### 19.1 Prototype vs. Production Engineering



- **Prototype Classification:** Treat rapidly generated or AI-assisted first implementations as prototypes until the applicable security, reliability, data-integrity, failure-mode, operational, privacy/compliance, deployment, observability, backup/recovery, and testing controls have been verified.

- **No Time-Based Readiness Assumption:** Development speed does not determine production readiness. A feature built in hours or days may still require significant engineering verification. Conversely, elapsed time alone does not prove maturity.

- **Happy Path Is Insufficient:** Do not mark a feature complete solely because its intended success flow works. Verify applicable authorization, tenant isolation, malformed/unexpected input, failure behavior, concurrency, retries, replay/idempotency, dependency outages, logging/auditability, rollback/recovery, and abuse cases.

- **AI Generation Is Not Verification:** AI-generated code, architecture, tests, configuration, or infrastructure recommendations remain unverified until supported by code/configuration inspection and executed evidence appropriate to the risk.

- **Engineering Completion Requires Evidence:** Use the existing Definition of Secure Engineering Done, production-readiness evidence rule, release gates, and APES assurance layers. Do not create a weaker "AI-built" completion standard.



### 19.2 Audit Before Reactive Remediation



- **Map Before Chasing:** When a system is experiencing repeated security/reliability discoveries, perform or refresh a holistic audit before continuing a long sequence of isolated fixes, unless an immediately exploitable or actively harmful issue requires emergency containment first.

- **Use the Existing 13-Layer APES Framework:** Assess the system across all applicable APES layers and record `PASS`, `PARTIAL`, `FAIL`, `UNKNOWN`, or `NOT APPLICABLE` with evidence. The 13-layer APES model is this directive's internal assurance framework; do not misrepresent it as a universal external standard.

- **Inventory Findings:** Consolidate confirmed defects, unknowns, technical debt, security gaps, operational gaps, compliance questions, and unverified controls into one auditable remediation register/backlog rather than relying on chat history, memory, scattered TODOs, or the recency of external advice.

- **Distinguish Discovery From Introduction:** A newly discovered weakness may have existed before it was noticed. Do not assume a recently discussed issue was recently introduced. Establish affected versions, origin, exposure window, and regression history where possible.

- **Emergency Exception:** P0/Critical issues, active compromise, exposed production credentials, broken tenant isolation, payment/financial manipulation, destructive corruption, or equivalent immediate threats may be contained/remediated before the broader audit is complete. Record the emergency action and return to the holistic audit afterward.



### 19.3 Risk-Based Prioritization, Not Recency-Based Prioritization



- **Priority Must Follow Risk:** Do not prioritize a finding merely because it is new, alarming, easy to fix, recently mentioned by an adviser, or currently receiving attention. Prioritize using verified likelihood/exploitability, technical impact, business impact, affected users/assets, exposure, detectability, and remediation dependencies.

- **Business Impact Factors:** Consider applicable consequences including:
  - unauthorized financial loss or manipulation;
  - confidentiality/privacy/data exposure;
  - integrity corruption or unreconciled financial state;
  - authentication/authorization or tenant-boundary failure;
  - destructive data loss;
  - service unavailability or material operational disruption;
  - regulatory/contractual/compliance exposure;
  - customer harm;
  - credential/secret compromise;
  - reputational/business continuity impact;
  - exploitability and attack surface.

- **Legal/Compliance Caution:** AI agents may identify potential legal, contractual, privacy, tax, or regulatory exposure, but MUST NOT convert uncertainty into unsupported legal conclusions. Mark uncertain applicability for authoritative verification or qualified review.

- **Use Existing Severity Gates:** Preserve the directive's P0/P1/P2/P3 release model. P0 and P1 findings remain blocking according to Section 7. Do not downgrade a finding because another newer issue appeared.

- **Dependency-Aware Ordering:** Fix prerequisite/root-cause controls before downstream symptoms where practical. Example: repair the canonical tenant-authorization boundary rather than patching individual routes one by one if the root cause is a shared authorization defect.

- **Risk Reduction Over Fix Count:** Do not optimize for the number of closed tickets. Prefer changes that materially reduce the highest verified risk and eliminate classes of recurring defects.

- **Do Not Ignore Cheap High-Value Fixes:** Risk-based prioritization does not prohibit low-cost improvements. A low-effort control may be pulled forward when it substantially reduces exposure and does not delay a blocking remediation.



### 19.4 Remediation Register Requirements



For material findings, track at least:

```text
Finding ID:
Source / discovery method:
Affected system/component:
APES layer(s):
Evidence:
Status:
Severity:
Likelihood/exploitability:
Technical impact:
Business impact:
Affected tenants/users/data:
Known exposure:
Root cause:
Required remediation:
Dependencies:
Regression tests required:
Owner:
Target release/milestone:
Verification required:
Residual risk:
Risk acceptance (if any):
```

Do not mark a finding `FIXED` because code was edited.

Use states such as:

`OPEN -> TRIAGED -> IN REMEDIATION -> IMPLEMENTED / UNVERIFIED -> VERIFIED -> CLOSED`

or an equivalent workflow that preserves the distinction between implementation and verification.



### 19.5 Root-Cause and Recurrence Control



- **Fix Classes of Defects:** When multiple findings share a root cause, prefer a systemic control plus regression coverage over repeated endpoint-by-endpoint patches.

- **Regression Tests:** Security, financial-integrity, tenant-isolation, data-integrity, and other high-impact remediations SHOULD add deterministic regression tests wherever practical.

- **Look for Siblings:** After confirming a defect, search for equivalent patterns elsewhere in the codebase, infrastructure, jobs, integrations, and other repositories where the same implementation pattern may have been reused.

- **AI-Generated Pattern Risk:** If an AI-generated implementation contains one systemic insecure pattern, assume similar generated code may contain the same pattern until searched and verified.

- **Update the Guardrail When Appropriate:** When a defect reveals a reusable engineering lesson not already covered by this directive, evaluate it for inclusion using the canonical non-destructive policy-update process rather than relying on memory.



### 19.6 Remediation Batch Verification



After a remediation batch:

1. Re-run tests specifically covering the findings.
2. Re-run applicable negative/adversarial tests.
3. Re-run typecheck/build/lint and dependency/security checks where relevant.
4. Re-assess affected APES layers.
5. Confirm no blocking regression was introduced.
6. Verify deployment/migration/rollback implications.
7. Update finding statuses from evidence.
8. Record unresolved risks and `UNKNOWN` controls.
9. Continue with the next highest-risk remediation batch.

Do not allow one successful fix to reset or erase the remaining remediation register.



### 19.7 Anti-Panic / Anti-Recency Rule



External security education, adviser feedback, incident reports, code-review findings, and newly learned techniques are valuable discovery inputs.

They MUST NOT become an unstructured sequence of emergency changes merely because they were encountered recently.

For each new recommendation:

1. Compare it with the current canonical directive.
2. Determine whether the control already exists.
3. Verify the technical claim where material.
4. Determine applicability to the actual architecture.
5. Identify the affected risk and APES layer.
6. Add/strengthen the global control only when useful.
7. Add project-specific findings to the remediation register.
8. Prioritize them against existing findings by risk.
9. Preserve earlier controls and evidence.
10. Re-audit after material remediation.

This converts continuing education into cumulative engineering maturity instead of an endless restart cycle.



### 19.8 Risk Acceptance



Not every non-blocking issue must be fixed immediately.

Where a risk is intentionally deferred or accepted:

- document the evidence and rationale;

- identify the responsible human decision-maker;

- record compensating controls;

- define review/expiration conditions where appropriate;

- do not silently relabel the finding as `PASS`;

- never use risk acceptance to bypass a P0/P1 release block unless the directive explicitly allows that category of human risk acceptance and the accountable owner explicitly accepts it.

> **OWNER POLICY OVERRIDE (OWNER:RELEASE-POLICY):** The exception clause in the bullet above is SUPERSEDED. No category of human risk acceptance exists that permits releasing with an open P0/P1 finding. Read the bullet as: "never use risk acceptance to bypass a P0/P1 release block."



### 19.9 Engineering Planning Release Gate



Before describing a repeatedly patched system as stabilized or production-ready, verify:

- a holistic APES assessment exists or applicable layers are explicitly marked unverified;

- known findings and unknowns are consolidated into a remediation register;

- priorities are based on risk/business impact rather than discovery recency;

- P0/P1 blockers are resolved or handled according to the directive's authorized risk process;

- root causes and sibling occurrences have been considered;

- fixes have regression verification;

- fixed findings are distinguished from implemented-but-unverified changes;

- unresolved risks are visible;

- the latest remediation batch has been re-audited;

- the canonical global directive remains intact and applicable release gates have been evaluated.

A prototype demonstrates possibility. Production engineering requires verified controls, prioritized risk reduction, and repeatable evidence.


---

## Owner-approved policy clarification

P0 and P1 findings are non-waivable production-release blockers. Risk acceptance under the source section on risk acceptance applies only to non-blocking findings. No agent or project operator may use the risk-acceptance process to waive, downgrade, or silently accept a P0/P1 finding.
