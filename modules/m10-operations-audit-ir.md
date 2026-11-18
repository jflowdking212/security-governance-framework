# M10 Operations, environment isolation, audit and incident response

**Source sections:** GLOBAL:1.G, GLOBAL:11, GLOBAL:18, GLOBAL:3:Layer10, GLOBAL:3:Layer11, GLOBAL:3:Layer12  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**### G. Error Handling, Environment Isolation & Security Audit Trails**



#### G1. Secure Error Handling & Unhappy-Path Resilience



- **Centralized Error Policy:** Applications MUST define a consistent error-handling strategy rather than relying on framework defaults or scattered ad-hoc `try/catch` behavior. Unexpected exceptions, provider failures, database failures, queue failures, validation failures, authorization failures, timeouts, and client rendering failures must resolve through documented failure behavior.

- **Safe User-Facing Errors:** Production responses MUST NOT expose stack traces, raw exception messages, SQL/database errors, filesystem paths, internal hostnames, framework versions, secrets, tokens, private identifiers, or implementation details. User-facing errors SHOULD be understandable and actionable without revealing sensitive internals.

- **Generic Does Not Mean Useless:** A generic HTTP `500` status may be correct for an unexpected server failure. The requirement is not to reveal technical detail; it is to provide a stable, safe error contract such as a user-safe message, retry guidance where appropriate, and a correlation/reference identifier when operationally useful.

- **Correct HTTP/API Semantics:** Distinguish expected client errors, authentication/authorization failures, conflicts, rate limits, validation failures, unavailable dependencies, and unexpected server failures using appropriate status/error semantics. Do not return `200 OK` for failed state-changing operations merely to simplify front-end handling.

- **No Fail-Open Error Paths:** Exceptions in authentication, authorization, tenancy, payment, entitlement, webhook verification, security policy, quota enforcement, or financial checks MUST deny the protected action unless an explicitly designed safe fallback exists.

- **Frontend Failure States:** User-facing applications SHOULD implement appropriate error boundaries/fallback screens and explicit loading, empty, unavailable, retryable, and terminal-error states so a component failure does not silently become a blank/white screen where the framework supports such controls.

- **Retry Safety:** Do not encourage or automatically perform retries for non-idempotent operations unless retry safety is proven. Retry messages and UI actions must not cause duplicate purchases, credits, submissions, deletions, or other state changes.

- **Operator Diagnostics:** Detailed exception context belongs in protected server-side diagnostics, observability, or error-monitoring systems with sensitive-data redaction and access control. Logs SHOULD include sufficient correlation context to diagnose the failure without exposing secrets or excessive personal/financial data.

- **Correlation IDs:** Where useful, generate or propagate a server-controlled request/correlation identifier across API, background job, provider call, and audit/error records. Do not trust a client-supplied correlation ID as an authorization or ownership signal.

- **Do Not Swallow Exceptions Silently:** Empty catch blocks or broad exception handlers that suppress failures without a justified fallback, diagnostic record, or compensating action are prohibited for security-, financial-, tenancy-, or integrity-sensitive paths.

- **Dependency Failure Behavior:** Define behavior for unavailable database, cache, queue, storage, payment provider, AI provider, email/SMS provider, identity provider, and other critical dependencies. Security or financial integrity controls MUST fail closed; non-critical features MAY degrade gracefully when explicitly designed to do so.

- **Mandatory Error-Path Verification:** Test applicable failures including malformed input, authorization denial, database outage, provider timeout, queue failure, storage failure, network error, duplicate/retry condition, thrown exception, unexpected null/empty response, front-end rendering failure, and partial-operation failure. Verify both user-visible behavior and protected diagnostic evidence.



#### G2. Development / Test / Staging / Production Isolation



- **Separate Trust Boundaries:** Development, test, preview, UAT/staging, and production are different trust zones. Production resources MUST NOT be casually reused by lower environments.

- **Database Isolation:** Production and non-production SHOULD use separate databases and separate database credentials. Development/UAT workloads MUST NOT have unrestricted write access to the production database. Exceptions require an explicit, documented, read-only or narrowly scoped operational purpose and authorization.

- **Credential Isolation:** Use separate production and non-production API keys, signing secrets, OAuth credentials, service accounts, webhook secrets, encryption/signing material, and other machine credentials wherever providers support separation.

- **Payment Environment Isolation:** Test/sandbox payment credentials, webhook endpoints/secrets, products/prices, customer records, and test-mode events must remain distinct from live production payment state. Test events MUST NOT create production entitlements or financial records.

- **Storage / Queue / Cache Isolation:** Where state crossover could affect users or integrity, separate production and non-production object storage buckets/prefixes, message queues/topics, caches/namespaces, search indexes, analytics destinations, email/SMS sender configurations, and equivalent resources.

- **Production Data in Lower Environments:** Do not copy real production customer data into development/test environments by default. Prefer synthetic data. If production-derived data is required for an authorized purpose, minimize and de-identify/anonymize it where feasible, restrict access, define retention/deletion, and protect it to an appropriate level.

- **Configuration Separation:** Environment-specific endpoints, identifiers, secrets, feature flags with security/financial impact, and infrastructure targets MUST be explicit. Harmless static configuration may be shared; do not interpret environment separation as requiring arbitrary duplication of every configuration value.

- **Environment Identity Guard:** High-risk applications SHOULD expose a machine-verifiable environment identity and validate critical combinations at startup/deploy time. For example, a development process SHOULD refuse to start against a known production database/payment account when that combination is not explicitly authorized.

- **No Accidental Production Mutation:** Local tools, tests, seeders, fixtures, migrations, destructive scripts, load tests, and AI agents MUST NOT default to production endpoints or production credentials.

- **Promotion, Not Copy/Paste:** Prefer promoting reviewed artifacts/configuration through controlled CI/CD stages rather than manually recreating production from an untracked development state. Production changes should preserve actor, artifact/commit, environment, and result evidence.

- **Access Separation:** Production administrative access SHOULD be more restrictive than development access. Do not grant a developer, test runner, CI job, or AI agent production privileges solely because it has lower-environment privileges.

- **Environment-Specific Safety Tests:** Verify that lower-environment credentials cannot access production resources where separation is supported; test webhooks cannot mutate production; test users/data do not appear in production; production databases are not targeted by automated tests/seeders; and production secrets are not available to preview/dev workloads without explicit need.



#### G3. Security Audit Trails for Sensitive Actions



- **Audit Trail Distinction:** Security audit trails are not ordinary debug/application logs. They are authoritative records of security-, administrative-, financial-, privacy-, and integrity-sensitive actions and must be designed for investigation and accountability.

- **Audit Sensitive Actions:** Record applicable events such as authentication/account-recovery changes, email/phone changes, password/MFA/recovery-factor changes, role/permission changes, tenant membership changes, administrator actions/impersonation, API-key/token lifecycle changes, secret rotation/revocation, billing/subscription changes, refunds/credits/manual financial adjustments, payment-state overrides, data export, destructive deletion, restore operations, configuration/security-policy changes, consent/legal-preference changes where relevant, and other privileged mutations.

- **Attempt + Outcome Where Material:** For high-risk actions, record both relevant denied/failed attempts and successful completion when doing so improves security detection or forensic reconstruction. Do not flood audit storage with meaningless noise that prevents detection.

- **Authoritative Actor Identity:** Actor identity, tenant, role/authorization context, and target resource MUST be derived from authenticated server-side context or trusted internal identity, not blindly accepted from client-supplied audit fields.

- **Minimum Audit Event:** Where applicable include: immutable/event identifier, timestamp, environment, application/service, authenticated actor/service identity, tenant/organization, action/event type, target resource type/identifier, outcome, authorization context, request/correlation ID, and source metadata appropriate to the threat model.

- **Before/After With Data Minimization:** For security-sensitive mutations, record a safe representation of what changed when useful for investigation. Do not blindly store full request bodies, plaintext secrets, passwords, session tokens, payment-card data, sensitive authentication factors, or unnecessary personal data. Use field allowlists, redaction, hashing/pseudonymization, or structured change summaries as appropriate.

- **Financial Evidence Correlation:** For disputed charges, refunds, subscription changes, and other payment actions, application audit trails SHOULD correlate with provider event/transaction identifiers and internal ledger/order/subscription records. An application audit log alone is not proof that a provider executed a financial transaction.

- **Tamper Resistance:** Audit records for high-value systems SHOULD be append-oriented and protected against modification/deletion by ordinary application users and operators who do not require that privilege. Use restricted storage, integrity controls, centralized logging, immutable/WORM-capable storage, cryptographic integrity techniques, or equivalent controls according to risk.

- **Access Control:** Audit logs may contain sensitive operational metadata. Restrict read/export/delete permissions. Access to audit records SHOULD itself be auditable for high-value systems.

- **Time Integrity:** Systems producing audit events SHOULD use reliable synchronized time so event ordering and incident reconstruction are meaningful.

- **Retention & Privacy:** Define retention appropriate to operational, contractual, legal, security, and privacy requirements. Do not retain sensitive audit data indefinitely merely because storage is available.

- **Availability Does Not Override Integrity:** Failure of a non-critical analytics logger must not necessarily take down the application, but failure of a legally/security-critical audit mechanism on a high-risk action must follow a documented policy. Do not silently claim an action was auditable if the audit event was never durably recorded.

- **Log Injection & Structured Logging:** Treat log fields as untrusted input. Prefer structured logging and sanitize/encode attacker-controlled values so newline/control-character injection cannot forge or corrupt audit events.

- **Mandatory Audit-Trail Verification:** Verify that sensitive actions produce the required event; unauthorized attempts are captured where required; actor/tenant/target are correct; cross-tenant data is not leaked; secrets/forbidden data are absent; log injection payloads cannot forge entries; ordinary users cannot modify/delete records; retention/access controls behave as intended; and events can be correlated end-to-end through request/job/provider identifiers.


---

**## 11. Monitoring, Incident Response & Vulnerability Management**



For production systems, implement or document:



- security contact ownership;

- vulnerability intake and triage;

- severity classification;

- patch/remediation SLAs where appropriate;

- incident detection and escalation;
- centralized exception/error monitoring and correlation;

- sensitive-action/security audit trail availability and integrity;

- containment and credential rotation/revocation;

- secret exposure investigation across source, relevant Git history, CI/CD output, logs, artifacts, prompts, screenshots, and backups where applicable;

- forensic/evidence preservation;

- customer/regulatory notification decision process;

- recovery;

- post-incident review;

- dependency/security update cadence.



Security fixes should add regression tests whenever practical so the same class of defect cannot silently return.



---

**## 18. Error Handling, Environment Isolation & Audit Trail Release Gate**



Do NOT mark a customer-facing or security-sensitive production system **ready** merely because its primary happy-path features work.

Before approval, verify as applicable:

- unexpected server exceptions are handled by a consistent production-safe error mechanism;

- production responses do not expose stack traces, raw database/provider errors, internal paths/hosts, framework internals, secrets, tokens, or sensitive identifiers;

- user-facing failures are understandable/actionable without leaking implementation details;

- security/authorization/payment/tenancy failures deny the protected action rather than fail open;

- frontend/app error boundaries or equivalent fallback states prevent avoidable blank-screen failures where the framework supports them;

- automatic/manual retries for state-changing operations cannot create duplicate side effects;

- error records contain adequate redacted diagnostics and correlation identifiers where useful;

- database, queue, cache, storage, network, and critical-provider outage behavior has been tested or explicitly documented as unverified;

- production databases and credentials are separate from development/test/UAT/staging where applicable;

- lower environments cannot unintentionally mutate production databases, payment state, object storage, queues/topics, caches, indexes, or equivalent stateful resources;

- automated tests, seeders, migrations, load tests, local tools, and AI agents do not default to production targets;

- real production customer data is not copied into lower environments by default and any authorized production-derived test data is minimized/protected;

- sandbox/test payment events and credentials cannot produce production entitlements or accounting state;

- environment-specific startup/deployment safeguards exist for combinations where accidental cross-environment targeting could cause material harm;

- sensitive account, authorization, administrative, financial, privacy, and destructive actions produce an appropriate audit event;

- audit events derive actor/tenant/target from trusted server-side context rather than client assertions;

- audit records contain sufficient action/time/outcome/correlation evidence for investigation while excluding passwords, secrets, tokens, payment-card data, and unnecessary sensitive data;

- audit records are protected from unauthorized modification/deletion according to system risk;

- log/audit access and retention are defined;

- attacker-controlled data cannot forge audit records through newline/control-character/log injection;

- application audit events can be correlated with provider/ledger/source-of-truth records for financial disputes where applicable;

- applicable negative tests from Section 1.G were actually executed or the limitation is explicitly reported.

A feature that succeeds only on the happy path is not production assurance. A production environment that shares mutable state with development is not isolated. An action that cannot later be attributed and reconstructed is not adequately auditable.


---

**### Layer 10 — Logging, Monitoring, Detection & Auditability**



Review structured application/security logs, centralized exception/error handling, correlation IDs, authentication events, authorization failures, account-recovery/security-factor changes, privilege/tenant-membership changes, administrator actions, destructive operations, data exports, billing/subscription/refund/manual-financial changes, webhook failures, unusual financial/integration events, secret-access/rotation/revocation events where available, authoritative actor/tenant/target attribution, audit-log tamper resistance and access control where required, alerting, uptime/health monitoring, error monitoring, log/audit retention, time synchronization, log-injection resistance, and sensitive-data redaction.

**### Layer 11 — Availability, Performance & Resilience**



Review timeouts, retry policy and idempotent retry safety, centralized failure handling, frontend/API fallback states, backpressure, pagination, queue/batch bounds, database indexes, N+1 behavior, memory/CPU/storage bounds, rate limiting, graceful degradation, dependency/provider outage behavior, provider fallback, circuit-breaker/cooldown behavior, partial-failure recovery, denial-of-service paths, and cost-amplification paths.

**### Layer 12 — Backup, Disaster Recovery & Incident Response**



Verify backup schedule, backup encryption, restore testing, point-in-time recovery where applicable, RPO/RTO, emergency/break-glass access, incident triage, containment, credential compromise identification, emergency rotation/revocation, customer/regulatory notification decision process, evidence preservation, recovery verification, post-incident review, rollback, and disaster runbooks.



A backup that has never been restore-tested is not sufficient evidence of recoverability.
