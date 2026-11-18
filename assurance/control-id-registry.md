# USS control ID registry

Control-family IDs are stable references for audit findings, test names and traceability. They identify requirements, not proof of implementation.

| Module | Control family | Scope |
|---|---|---|
| M01 | ENG-01 to ENG-20 | Core operating policy and secure engineering |
| M02 | AUTH-01 to AUTH-12 | Authentication, passwords, MFA, recovery, sessions |
| M03 | TEN-01 to TEN-12 | BOLA/IDOR, RBAC, ownership and tenant isolation |
| M04 | INPUT-01 to INPUT-18 | Injection, validation, output encoding, CSRF, file safety |
| M05 | API-01 to API-12 | TLS, API hygiene, limits, abuse and transport |
| M06 | PAY-01 to PAY-24 | Webhook authenticity, raw body, replay, idempotency, invariants |
| M07 | TAX-01 to TAX-16 | Jurisdiction exposure, classification, location evidence, filing and reconciliation |
| M08 | SECRET-01 to SECRET-18 | Secret lifecycle, storage, access, rotation and revocation |
| M09 | DATA-01 to DATA-12 | Privacy, protection, residency and data minimisation |
| M10 | OPS-01 to OPS-20 | Errors, environment isolation, audit trails, monitoring and incident response |
| M11 | AI-01 to AI-14 | Prompt injection, tool boundaries, tenant isolation, model governance |
| M12 | SUPPLY-01 to SUPPLY-20 | CI/CD, infrastructure, dependencies and supply chain |
| M13 | SELF-01 to SELF-16 | Mandatory in-line adversarial/self-audit vectors |
| M14 | ASSURE-01 to ASSURE-13 | The 13-layer assurance model |
| M15 | EVID-01 to EVID-20 | Production evidence, assurance pack and reporting |
| M16 | TEST-01 to TEST-12 | Audit lifecycle and authorised penetration testing |
| M17 | SEV-01 to SEV-12 | Severity classification and release gates |
| M18 | COMM-01 to COMM-08 | Public security communication |
| M19 | FIN-01 to FIN-16 | Financial integration and revenue release gate |
| M20 | REM-01 to REM-20 | Audit-first, risk-based remediation and risk acceptance |
| M21 | CORS-01 to CORS-20 | Cross-origin browser trust boundaries |
| M22 | AGENT-01 to AGENT-15 | Agent execution contract |

Do not invent sub-control implementation status from this registry. Consult the authoritative module and verify the application evidence.
