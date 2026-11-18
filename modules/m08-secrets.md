# M08 Secrets, credentials and lifecycle management

**Source sections:** GLOBAL:1.F, GLOBAL:17  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**### F. Secret Lifecycle, Rotation & Centralized Secret Management Maturity**



- **\*\*Mandatory Baseline Now:\*\*** Every production credential, API key, database password, signing secret, service token, certificate, private key, and equivalent machine credential MUST have an explicit lifecycle: `create -> distribute -> use -> monitor -> rotate -> revoke -> expire`. Secure storage, least privilege, environment separation where supported, leak prevention, revocation capability, and documented rotation are mandatory even when no dedicated external secret manager is used.

- **\*\*Local .env Is Not Automatically a Vulnerability:\*\*** A local development `.env` file may be acceptable when it contains no production credentials, is excluded from Git, is access-controlled locally, and is not distributed casually. Production secrets MUST NOT be committed to `.env` files in source control or shipped inside application/client artifacts.

- **\*\*Production Storage Outcome, Not Vendor Mandate:\*\*** Production secrets MUST be protected server-side through an approved platform secret facility, secret manager, orchestrator/environment injection mechanism, workload identity, or equivalent architecture. Do not require Infisical, Doppler, AWS Secrets Manager, Vault, Vercel, or any other specific product merely to satisfy policy.

- **\*\*Centralized Secret Manager — Planned Maturity Control:\*\*** A dedicated centralized secret-management platform is RECOMMENDED and becomes a required architecture review item when credential sprawl, multiple production services, multiple operators/agents, enterprise or compliance requirements, automated rotation needs, meaningful customer/financial exposure, or cross-environment distribution make manual management materially risky. Existing production applications MUST NOT be migrated solely for checklist compliance without a staged migration, verification, and rollback plan.

- **\*\*No Unauthorized Procurement or Migration:\*\*** AI/IDE agents MUST NOT purchase, subscribe to, enable, or migrate production systems to a paid secret-management service without explicit user authorization. Do not silently introduce a new runtime dependency into a working production system.

- **\*\*Environment Separation:\*\*** Development, preview, staging, test, and production SHOULD use separate credentials wherever the provider permits. Do not automatically propagate one high-privilege credential across every environment. Compromise of a lower environment should not unnecessarily compromise production.

- **\*\*Least Privilege and Credential Scope:\*\*** Prefer per-service, per-environment, narrowly scoped credentials, workload identities, short-lived credentials, and dynamic credentials over broad long-lived shared secrets. Do not reuse one powerful credential across unrelated products when the provider supports safer separation.

- **\*\*Secret Retrieval Patterns:\*\*** Do not mandate one retrieval model. Approved patterns may include runtime retrieval, startup retrieval, workload identity, sidecar/agent injection, in-memory mounted secret files, orchestrator injection, or platform-managed environment injection. Do not fetch a remote secret manager on every request unless the architecture requires it; doing so may add latency and a new availability dependency.

- **\*\*Secret-Manager Failure Behavior:\*\*** If runtime/startup retrieval is used, define timeout, caching/refresh, startup failure, outage, recovery, and break-glass behavior. Security-critical workloads MUST NOT fall back to placeholder, default, unauthenticated, or knowingly invalid credentials when retrieval fails.

- **\*\*Provider-Supported Rotation Only:\*\*** Never assume an upstream provider supports two simultaneously valid API keys, alternating credentials, or programmatic rotation. Verify provider capabilities before implementing dual-key rotation. If only one active credential is supported, use the provider's documented safe rotation procedure.

- **\*\*Zero/Low-Downtime Rotation Where Supported:\*\*** When overlapping credentials are supported, prefer: generate replacement while current credential remains valid -> store/distribute replacement securely -> update intended consumers -> verify successful authenticated traffic/health using the replacement -> confirm dependent services transitioned -> revoke previous credential -> verify revoked credential fails -> record rotation evidence.

- **\*\*Do Not Revoke Blindly:\*\*** Do not revoke the last known-good credential before proving required workloads can use the replacement unless an active compromise requires immediate containment. A failed rotation must stop safely rather than causing avoidable production outage.

- **\*\*Automation With Verification, Not Blind Cron:\*\*** Automate rotation when the provider exposes a safe API/mechanism and replacement distribution, verification, rollback, idempotency, observability, and revocation can be implemented reliably. A rotation workflow MUST NOT blindly execute `generate -> replace -> revoke` without proving the replacement is active and healthy.

- **\*\*No Universal 30-Day Rule:\*\*** Do not impose one arbitrary rotation interval on every secret. Determine lifetime from provider requirements, credential scope, impact of compromise, rotation capability, regulatory/contractual obligations, and architecture. Prefer short-lived/dynamic credentials where practical. Scheduled rotation does not replace immediate incident-response rotation.

- **\*\*Suspected Exposure:\*\*** A production credential known or reasonably suspected to have leaked is compromised regardless of where it is currently stored. Do not merely move it into a secret manager. Identify scope, replace/rotate it using the provider-safe procedure, revoke it as quickly as safely possible, search source/current and relevant Git history, CI/CD output, build artifacts, logs, tickets, prompts, screenshots, backups, and other likely exposure locations, investigate unauthorized use, preserve evidence, and add regression controls.

- **\*\*Secret Inventory:\*\*** Maintain an inventory appropriate to system maturity containing secret identifier/name, provider/system, purpose, owning service, environment, privilege/scope, consumers, storage mechanism, creation date where available, last rotation, rotation/expiration policy, responsible owner, rotation procedure, and revocation procedure. Never store the plaintext secret itself in the inventory.

- **\*\*Auditability:\*\*** Where supported, monitor secret creation, access/retrieval, updates, rotation, revocation, deletion, permission changes, and unusual retrieval frequency. Minimize direct human access to production secret values.

- **\*\*Mandatory Negative Verification:\*\*** Where applicable test: missing secret -> fail closed; empty secret -> fail closed; known placeholder/mock secret -> fail closed; wrong-environment secret -> fail closed; revoked credential -> rejected; replacement credential -> verified before old-key revocation; old credential -> rejected after completed rotation; unauthorized workload -> cannot retrieve secret; lower-environment credential -> cannot access production; secrets -> absent from source/current and relevant Git history, client bundles, logs, telemetry, and build artifacts; failed automated rotation -> does not silently revoke last known-good credential; rotation job -> idempotent; secret-manager outage -> follows documented failure behavior.

- **\*\*Migration Policy for Existing Production Systems:\*\*** Do not disrupt a functioning production application merely to replace an already protected server-side environment/platform secret mechanism with a dedicated manager. First assess actual exposure and operational benefit. If migration is justified, use a staged plan with inventory, backup/rollback, parallel verification where possible, health checks, secret revocation after confirmed cutover, and post-migration negative verification.

**## 17. Secret Management & Rotation Release Gate**



Do NOT mark secret handling **secure**, **complete**, or **production-ready** merely because values were moved out of source code or placed in a dashboard/environment-variable screen.

Before approval, verify as applicable:

- production credentials are not hardcoded, committed, exposed client-side, baked into images/build artifacts, or logged;

- current source and relevant Git history have been scanned for credentials;

- production credentials use a protected server-side storage/injection mechanism;

- development/test/staging/production credential separation exists where provider support and architecture permit;

- credentials are least-privileged and not unnecessarily reused across unrelated products/services;

- every material credential has an owner, consumer mapping, revocation path, and documented rotation procedure;

- missing, empty, placeholder, mock, wrong-environment, or unavailable security-critical secrets fail closed;

- suspected leaked credentials are rotated/revoked immediately rather than waiting for a scheduled interval;

- dual-key/alternating rotation is used only when the provider actually supports it;

- automated rotation, if enabled, verifies replacement health before old-key revocation, is idempotent, observable, and has defined failure/rollback behavior;

- no arbitrary universal rotation interval is presented as authoritative without provider/risk/compliance justification;

- centralized secret-management adoption has been assessed according to credential sprawl, operators, customer/financial exposure, enterprise/compliance requirements, and automation needs;

- an existing protected production secret path is not migrated solely for policy compliance without a staged migration, verification, and rollback plan;

- no paid secret-management product or production migration was enabled without explicit authorization;

- runtime/startup secret-manager dependency behavior is defined if an external manager is used;

- applicable negative tests from Section 1.F were actually executed or the limitation is explicitly reported.

A secret moved to a different storage location is not automatically a well-managed secret. Secure secret management is a verified lifecycle, not a vendor name.


---
