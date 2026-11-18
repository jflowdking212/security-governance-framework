# Audit-first remediation lifecycle

1. **Scope and map:** establish authority, architecture, data flows, environments, trust boundaries and critical assets.
2. **Assess:** evaluate all 13 assurance layers and mark unknowns explicitly.
3. **Register:** consolidate confirmed defects, unknowns, technical debt, operational gaps and compliance questions.
4. **Triage:** prioritise by verified likelihood/exploitability, impact, exposure, affected assets and dependencies, not recency or fix count.
5. **Contain:** urgently contain active P0 threats, compromise, exposed credentials, tenant breach, financial manipulation or destructive corruption. Record the action and return to the holistic audit.
6. **Remediate root causes:** inspect sibling paths and patterns; avoid symptom-only patches.
7. **Verify:** rerun targeted regression, negative/adversarial tests, typecheck/build/lint and dependency/security checks as applicable.
8. **Reassess:** update affected assurance layers, migration/rollback impact and residual risk.
9. **Close by evidence:** OPEN -> TRIAGED -> IN REMEDIATION -> IMPLEMENTED / UNVERIFIED -> VERIFIED -> CLOSED.

**Release policy clarification:** P0 and P1 findings are non-waivable production-release blockers. The source risk-acceptance process applies only to P2/P3. A human note or agent decision cannot convert P0/P1 into PASS.

A code edit alone does not close a finding. Do not let one successful fix erase remaining findings.
