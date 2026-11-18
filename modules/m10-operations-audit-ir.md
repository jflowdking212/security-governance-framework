# M10 Errors, logging, monitoring and incident response

## Controls
- Return safe, actionable errors. Never expose stack traces, secrets, tokens, SQL, internal paths, personal data, or cross-tenant details to unauthorised clients.
- Centralise error handling. Preserve redacted diagnostic context and correlation IDs for operators.
- Audit security-significant actions: actor/service, tenant, target resource, time, request/provider correlation, action, and outcome. Do not rely on client-supplied actor identity.
- Log authentication events, authorisation failures, account recovery/security-factor changes, privilege/membership changes, destructive operations, exports, financial changes, webhook failures, and secret lifecycle events where relevant.
- Redact secrets, tokens, sensitive payment data, and unnecessary personal information. Protect audit log access and integrity.
- Monitor unusual authentication, authorisation, financial, integration, resource-consumption, and availability patterns. Define escalation ownership.
- Use bounded timeouts, retries, backoff, idempotent retry safety, pagination, backpressure, circuit breakers/cooldowns, and graceful degradation.
- Design safe behaviour for database, cache, queue, storage, AI, payment, provider, and network failures. Fail closed where security or financial integrity requires it.
- Define incident triage, containment, evidence preservation, credential compromise response, notification decision process, recovery verification, and post-incident review.
- Backups must be restore-tested. Record RPO/RTO and recovery runbooks where applicable.

## Source basis
Global directive Sections 1.G, 10-12, 18; APES Layers 10-12; Self-audit vectors 8, 9, 11, 12, 14-16.
