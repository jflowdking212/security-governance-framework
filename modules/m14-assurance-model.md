# M14 13-layer production security assurance model

**Source sections:** GLOBAL:3  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**## 3. APES-STYLE 13-LAYER PRODUCTION SECURITY ASSURANCE**



Before declaring a production system ready for serious customer or enterprise use, evaluate the entire system across the following 13 layers.



For every layer, report:



\- **\*\*Status:\*\*** \`PASS\`, \`PARTIAL\`, \`FAIL\`, \`UNKNOWN\`, or \`NOT APPLICABLE\`

\- **\*\*Verified Evidence\*\***

\- **\*\*Risks / Findings\*\***

\- **\*\*Required Remediation\*\***

\- **\*\*Verification Performed\*\***

\- **\*\*Residual Risk / Known Limitation\*\***



Do not invent evidence and do not convert an unknown control into a pass.



**### Layer 1 — Identity & Session Security**



Review registration, login, logout, password reset, MFA/2FA readiness, password hashing, account recovery, session issuance/expiration/invalidation/rotation, cookie security, bearer-token exposure, brute-force/credential-stuffing controls, OTP/reset abuse, and stale sessions after privilege/account changes.



**### Layer 2 — Authorization & Tenant Isolation**



Review RBAC/ABAC policy, BOLA/IDOR, cross-tenant reads/writes, parent-child ownership, route/service permission consistency, admin privilege escalation, suspended/removed account behavior, demo/test tenant isolation, and tenant boundaries in background jobs/caches.



**### Layer 3 — Application, API & Client Security**



Review schema validation, SQL/NoSQL/command injection, XSS, CSRF where applicable, SSRF, path traversal, unsafe deserialization, open redirects, mass assignment, insecure direct file/object access, request bounds, rate limits, and websocket authentication/message authorization.



**### Layer 4 — Data Protection, Privacy & Residency**



Verify encryption in transit, encryption at rest where required, secret/key storage, environment separation, least-privilege credential scope, rotation/revocation readiness, secret exposure history, personal/financial data minimization, retention/deletion behavior, backup encryption, export controls, log redaction, hosting/storage provider and region, data residency, subprocessors, and external AI-provider data transmission.



If hosting region, encryption-at-rest configuration, or retention policy cannot be verified from authoritative configuration, mark it \`UNKNOWN\` rather than assuming.



**### Layer 5 — Database, Financial & Transaction Integrity**



Review schema constraints, decimal/fixed financial precision, atomic transactions, event and business-level idempotency, reconciliation, race conditions, migration safety, rollback, destructive operations, foreign-key behavior, orphan prevention, duplicate detection, ledger/source-of-truth consistency, payment/refund/subscription state transitions, entitlement uniqueness, financial auditability, and concurrency controls.



**### Layer 6 — Integrations, Webhooks & External APIs**



Review webhook/provider inventory, provider-specific signature verification, raw-body preservation, behavior when signatures/secrets are missing or invalid, replay/freshness protection, event/delivery identifiers, atomic event idempotency, business-level idempotency, duplicate acknowledgement semantics, out-of-order delivery handling, event allowlisting, tenant/resource mapping, live/test environment separation, amount/currency/customer/order invariants, secret rotation, API credential scope, provider rate limits, retry/backoff, provider outage behavior, schema/version drift, and inbound/outbound data exposure.



**### Layer 7 — Dependencies & Software Supply Chain**



Review lockfiles, deterministic installs, dependency vulnerabilities, malicious/abandoned packages, transitive risk, SBOM availability, secret scanning, SAST/static scanning, package scripts, CI action pinning, artifact provenance, generated binary artifacts, and source-control history for leaked credentials.



**### Layer 8 — Infrastructure, Hosting & Network Security**



Review or verify production topology, exposed services/ports, firewall/security groups, reverse proxy configuration, TLS termination, database network exposure, SSH/admin access, host/container hardening, least-privilege service accounts, filesystem permissions, object storage ACLs, secrets injection/retrieval, explicit dev/test/staging/production resource separation, database/account separation, lower-environment access to production, production-data use in non-production, secret-manager/startup outage behavior where applicable, credential scope, and patch/update process.



Do not infer infrastructure controls from application code alone.



**### Layer 9 — CI/CD & Release Security**



Review protected branches, mandatory status checks, immutable/pinned workflow dependencies, build/test gates, deployment approvals, environment-scoped secrets, prevention of secret exposure in CI logs/artifacts, prevention of lower-environment jobs/tests/seeders from targeting production, credential rotation/deployment implications, immutable artifact promotion, migration gates, staging validation, production health checks, deployment concurrency locking, rollback, exact commit/release traceability, and prohibition of fail-open deployment.



A successful \`git push\` only proves the remote received the commit. It does NOT prove CI, security review, deployment, or production health succeeded.



**### Layer 10 — Logging, Monitoring, Detection & Auditability**



Review structured application/security logs, centralized exception/error handling, correlation IDs, authentication events, authorization failures, account-recovery/security-factor changes, privilege/tenant-membership changes, administrator actions, destructive operations, data exports, billing/subscription/refund/manual-financial changes, webhook failures, unusual financial/integration events, secret-access/rotation/revocation events where available, authoritative actor/tenant/target attribution, audit-log tamper resistance and access control where required, alerting, uptime/health monitoring, error monitoring, log/audit retention, time synchronization, log-injection resistance, and sensitive-data redaction.



**### Layer 11 — Availability, Performance & Resilience**



Review timeouts, retry policy and idempotent retry safety, centralized failure handling, frontend/API fallback states, backpressure, pagination, queue/batch bounds, database indexes, N+1 behavior, memory/CPU/storage bounds, rate limiting, graceful degradation, dependency/provider outage behavior, provider fallback, circuit-breaker/cooldown behavior, partial-failure recovery, denial-of-service paths, and cost-amplification paths.



**### Layer 12 — Backup, Disaster Recovery & Incident Response**



Verify backup schedule, backup encryption, restore testing, point-in-time recovery where applicable, RPO/RTO, emergency/break-glass access, incident triage, containment, credential compromise identification, emergency rotation/revocation, customer/regulatory notification decision process, evidence preservation, recovery verification, post-incident review, rollback, and disaster runbooks.



A backup that has never been restore-tested is not sufficient evidence of recoverability.



**### Layer 13 — AI/LLM Security & Governance**



For AI-enabled systems or AI-assisted engineering workflows, review prompt injection, untrusted repository/document/user content, tool permission boundaries, provider/model allow-lists, secret leakage, sensitive-data transmission, tenant-data crossover through prompts/embeddings/caches/retrieval, hallucination controls, deterministic calculations for financial/security-critical facts, structured output validation, provider failure/fallback, model escalation, rate/quota exhaustion, logging/redaction, human approval for high-impact actions, autonomous deployment/destructive actions, and auditability of AI decisions.



For financial or security-sensitive systems, AI MUST interpret verified facts rather than invent authoritative values.



\---
