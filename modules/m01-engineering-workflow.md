# M01 Engineering workflow and secure development

## Scope
Applies to all code, configuration, infrastructure, AI-assisted changes, reviews, and maintenance.

## Controls
- Treat AI-generated code, architecture, tests, and configuration as unverified until inspected and tested.
- Audit before repeatedly patching isolated symptoms. Maintain one remediation register and prioritise by exploitability, likelihood, impact, exposure, and dependencies, not recency or fix count.
- Preserve existing business behaviour unless a verified defect requires change. Identify destructive, migration-sensitive, and operationally risky work before implementation.
- Work only within explicitly authorised systems and environments.
- Use least privilege, secure defaults, explicit trust boundaries, defence in depth, and fail-closed behaviour for security-sensitive decisions.
- Do not use shortcuts that disable TLS, CSRF where applicable, authentication, authorisation, tenant isolation, validation, or release gates.
- Review sibling code paths when a systemic defect is found. Fix root causes and add regression tests.
- Separate prototype success from production engineering completeness.
- Preserve human approval for deployment, destructive migration, data deletion, credential rotation/revocation, paid services, and production policy changes.
- Every change must have an evidence trail and rollback/recovery consideration.

## Required workflow
1. Establish scope, authority, architecture, and environment.
2. Inspect existing code/configuration before changing it.
3. Identify applicable modules and resolve dependencies.
4. Record findings before remediation except for urgent containment of active P0 threats.
5. Make minimal, reviewable changes.
6. Run targeted regression and adversarial tests, then relevant project checks.
7. Reassess affected assurance layers and update finding statuses from evidence.
8. Report residual risk and unverified controls.

## Source basis
Global directive core persona/constraints; Sections 5, 13, 14, 19.1-19.7.
