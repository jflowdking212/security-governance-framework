# 13-Layer Security Assurance Model

Assess every layer as PASS, PARTIAL, FAIL, UNKNOWN, or NOT APPLICABLE. For each layer record verified evidence, risks/findings, required remediation, verification performed, and residual risk. Never convert UNKNOWN into PASS.

1. **Identity & Session Security:** registration, login, recovery, MFA, password hashing, session issue/expiry/invalidation/rotation, cookies, abuse controls.
2. **Authorisation & Tenant Isolation:** RBAC/ABAC, BOLA/IDOR, cross-tenant access, parent-child ownership, jobs, caches, exports, suspended users.
3. **Application, API & Client Security:** validation, injection, XSS, CSRF, SSRF, path traversal, mass assignment, files, request bounds, rate limits, websockets.
4. **Data Protection, Privacy & Residency:** encryption, keys, retention/deletion, minimisation, backups, exports, logs, hosting region, subprocessors, AI data transmission.
5. **Database, Financial & Transaction Integrity:** constraints, precision, transactions, idempotency, reconciliation, race conditions, migrations, rollback, ledger, entitlements.
6. **Integrations, Webhooks & External APIs:** inventory, signatures, raw body, secrets, freshness, replay, idempotency, ordering, event allowlists, mapping, environment separation.
7. **Dependencies & Software Supply Chain:** lockfiles, deterministic installs, vulnerabilities, malicious packages, SBOM, secret scan, SAST, scripts, action pinning, provenance.
8. **Infrastructure, Hosting & Network Security:** topology, ports, firewalls, TLS, database exposure, admin access, hardening, service accounts, storage ACLs, secret injection, environment separation.
9. **CI/CD & Release Security:** branch protection, status checks, immutable workflows, approvals, scoped secrets, artifact promotion, migration gates, health checks, rollback, traceability.
10. **Logging, Monitoring, Detection & Auditability:** structured logs, correlation, security events, actor/tenant attribution, tamper resistance, alerting, retention, redaction, time sync.
11. **Availability, Performance & Resilience:** timeouts, retries, backpressure, pagination, bounds, indexes, graceful degradation, provider outage, circuit breakers, DoS/cost amplification.
12. **Backup, Disaster Recovery & Incident Response:** schedules, encryption, restore tests, RPO/RTO, break-glass, triage, containment, rotation, evidence, recovery, post-incident review.
13. **AI/LLM Security & Governance:** prompt injection, tool boundaries, provider allow-lists, secret leakage, tenant crossover, hallucination controls, deterministic calculations, output validation, quotas, human approval.

The 13-layer model is an internal assurance framework. Do not represent it as a universal external standard or certification.
