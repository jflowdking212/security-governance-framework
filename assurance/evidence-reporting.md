# Evidence and reporting contract

Every material security report must include:

- Project/repository, commit/ref, environment, scope, authorisation, date, USS version, and bundle/module IDs.
- Each assurance layer's status: PASS, PARTIAL, FAIL, UNKNOWN, NOT APPLICABLE.
- Control ID, evidence location, observation, verification method, and test result.
- Findings: unique ID, source, affected component, severity, likelihood/exploitability, technical/business impact, affected users/tenants/data, root cause, remediation, dependencies, regression tests, owner, milestone, status, residual risk.
- Commands actually executed, tool versions, pass/fail counts, exit codes, and relevant logs/artifacts.
- Explicit distinction between implemented/unverified and verified.
- Unresolved blockers, unknowns, deployment/migration impact, rollback and recovery plan.

Never invent evidence, test output, certifications, penetration tests, compliance status, or production configuration. Redact secrets and unnecessary personal data.
