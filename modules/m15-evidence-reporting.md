# M15 Production evidence, assurance pack and reporting

**Source sections:** GLOBAL:4, GLOBAL:9, GLOBAL:12  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**## 4. Production-Readiness Evidence Rule**



Compilation success, unit tests, AI review, or a clean static scan are necessary but not sufficient for a production-ready claim.



Before stating that a system is production-ready, verify or explicitly mark unknown at least:



- authentication and authorization;

- tenant isolation;

- secrets management, exposure scanning, rotation/revocation readiness, and environment separation;

- centralized secret-management requirement/maturity decision where applicable;

- development/test/staging/production isolation, including databases, credentials, payment/test state, storage/queues/caches where applicable;

- centralized error handling and verified unhappy-path behavior;

- sensitive-action audit trail coverage, integrity/access controls, retention, and redaction;

- encryption in transit;

- encryption at rest where applicable;

- dependency/security scanning;

- backups and restore verification;

- incident response;

- monitoring/alerting;

- data storage location/residency;

- infrastructure/network controls;

- deployment/rollback;

- external integrations/webhooks;

- financial integrity if applicable;

- AI/LLM data handling if applicable.



Where evidence is unavailable, say:



\> **\*\*Not verified from the available repository/configuration.\*\***



Never transform absence of evidence into evidence of security.



---

**## 9. Enterprise Security Evidence Pack**



For serious production/enterprise products, maintain an evidence directory such as:



```text

docs/security/

├── SECURITY_POLICY.md

├── SECURITY_ARCHITECTURE.md

├── DATA_HANDLING.md

├── DATA_RESIDENCY.md

├── ENCRYPTION_STANDARD.md

├── SECRET_MANAGEMENT.md

├── ERROR_HANDLING_STANDARD.md

├── ENVIRONMENT_ISOLATION.md

├── AUDIT_LOGGING_STANDARD.md

├── ACCESS_CONTROL.md

├── VULNERABILITY_MANAGEMENT.md

├── INCIDENT_RESPONSE.md

├── BACKUP_AND_RECOVERY.md

├── BUSINESS_CONTINUITY.md

├── SUBPROCESSORS.md

├── AI_DATA_GOVERNANCE.md

├── PAYMENT_WEBHOOK_SECURITY.md

├── TAX_COMPLIANCE.md                 # when revenue/tax obligations apply

├── PENETRATION_TEST_SUMMARY.md

└── SECURITY_ASSURANCE_REPORT.md

```



Only include claims supported by verified implementation or authoritative operational evidence.



For procurement/security questionnaires, answer from evidence rather than memory.



Examples:



- “Do you encrypt data at rest?” → cite the verified provider/configuration/control.

- “When was your last vulnerability scan?” → cite dated scan evidence.

- “Do you have an incident response plan?” → cite the maintained plan.

- “Where is customer data stored?” → cite provider/region/data-residency documentation.

- “When was your last penetration test?” → cite the actual external test date/provider/scope; never substitute an AI review.



---

**## 12. Required Final Security Reporting Contract**



When completing a production-sensitive engineering task, report concise evidence in this format:



```text

Requirement:

Files changed:

Architecture impact:

Database impact:

API impact:

Security impact:

Secrets/credential impact:

Environment-isolation impact:

Error/failure-path impact:

Audit-trail/logging impact:

Tenant-isolation impact:

Financial/integrity impact:

Webhook/payment trust impact:

Tax/compliance impact (if applicable):

External-provider/data impact:

Tests added/updated:

Local checks performed:

CI/security checks:

Known limitations:

Unverified production controls:

Deployment impact:

Rollback considerations:

Residual risk:

```



For a broader audit, use:



```text

Layer:

Status: PASS | PARTIAL | FAIL | UNKNOWN | NOT APPLICABLE

Evidence:

Findings:

Severity:

Required remediation:

Verification performed:

Residual risk:

```



Never report a check as passed unless it was actually executed or supported by authoritative evidence.



---
