# M05 Network, transport and API hygiene

**Source sections:** GLOBAL:1.D  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**### D. Network, Transport & API Hygiene**



- **Strict CORS Policy:** Deny `Access-Control-Allow-Origin: *` whenever credentials, cookies, authorization headers, or private data are involved. Explicitly configure trusted origins.

- **TLS:** Require TLS for production traffic. Do not disable certificate verification in production integrations.

- **Rate Limiting & Abuse Prevention:** Apply rate limits to authentication, AI/LLM, file ingestion, expensive queries, report generation, search, webhook test endpoints, and other resource-heavy operations.

- **Request Limits:** Enforce body, file, timeout, concurrency, pagination, and query-complexity limits.

- **Information Disclosure:**

  - Strip stack traces, raw database errors, filesystem paths, internal hostnames, and server internals from production responses.

  - Return standardized client-safe errors while writing detailed diagnostics to secured server logs.

- **Secrets Management:**

  - Zero hardcoded API keys, private keys, database credentials, signing secrets, passwords, or access tokens in source code, client bundles, container images, build artifacts, logs, screenshots, or AI prompts.

  - Production secrets MUST use an approved protected server-side secret store, platform-managed secret facility, orchestrator injection, workload identity, or secure environment-injection mechanism appropriate to the architecture.

  - Local development `.env` files MAY be used when appropriate only if they contain no production credentials, are excluded from source control, are protected locally, and are not casually shared.

  - Ensure `.env`, dumps, backups, temporary credentials, private keys, and generated sensitive artifacts are excluded from version control. Scan current source and relevant Git history for leaked credentials.

  - Dedicated centralized secret managers are RECOMMENDED maturity controls, not universally mandatory for every existing application. Apply **Section 1.F — Secret Lifecycle, Rotation & Centralized Secret Management Maturity**.

  - Do not log secrets, expose them to browser/client code, or include live secret values in AI prompts.

- **Webhook Security:** Every state-changing webhook or provider callback MUST satisfy **Section 1.E — Payment, Webhook & External Event Integrity**. Security-critical webhooks must fail closed when required verification material is missing, invalid, stale, or unverifiable.
