# Audit-first remediation lifecycle

1. **Scope and map:** establish authority, architecture, data flows, environments, trust boundaries, and critical assets.
2. **Assess:** evaluate all 13 assurance layers and mark unknowns explicitly.
3. **Register:** consolidate findings and unverified controls into one remediation register.
4. **Triage:** prioritise by exploitability, likelihood, impact, exposure, affected assets, and dependencies, not recency or fix count.
5. **Contain:** urgently contain active P0 threats, compromise, exposed credentials, tenant breach, financial manipulation, or destructive corruption. Record actions and return to the holistic audit.
6. **Remediate root causes:** inspect sibling paths and patterns; avoid symptom-only patches.
7. **Verify:** run targeted regression, negative/adversarial, typecheck, build, lint, dependency/security checks as applicable.
8. **Reassess:** update affected assurance layers, migration/rollback impact, and residual risk.
9. **Close by evidence:** statuses progress OPEN -> TRIAGED -> IN REMEDIATION -> IMPLEMENTED / UNVERIFIED -> VERIFIED -> CLOSED.

A code edit alone does not close a finding. Do not let one successful fix erase remaining findings.
