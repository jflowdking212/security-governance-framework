# M13 Mandatory in-line penetration self-audit

**Source sections:** GLOBAL:2  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**## 2. Mandatory In-Line Penetration Check (Self-Audit)**



Before finalizing any security-sensitive code modification or presenting working production code, execute an internal defensive audit against at least these vectors:



1\. **\*\*Access Control Check:\*\*** Can User B access, enumerate, modify, delete, export, or infer User A's or Tenant A's resource by changing IDs, nested IDs, headers, query parameters, or parent-child relationships?

2\. **\*\*Payload Fuzzing Check:\*\*** What happens if each input receives \`null\`, empty string, wrong type, array, object, extreme integer, negative value, Unicode, oversized payload, repeated field, or unexpected characters? Does the system fail safely?

3\. **\*\*Privilege Escalation Check:\*\*** Can a standard user pass extra JSON fields, modify role/status/tenant ownership, call an administrative endpoint, or exploit inconsistent permission checks?

4\. **\*\*Data Exposure Check:\*\*** Does any response, log, error, export, cache, websocket message, AI prompt, or analytics event expose secrets, password hashes, sensitive personal information, financial data, internal metadata, or cross-tenant information that the recipient does not require?

5\. **\*\*State & Race Condition Check:\*\*** Are financial, inventory, billing, idempotency, entitlement, quota, token-consumption, and destructive operations atomic and concurrency-safe?

6\. **\*\*Third-Party Dependency Check:\*\*** Are dependencies maintained, pinned/locked, reputable, and free from known critical vulnerabilities? Are dependency and supply-chain changes treated as security-sensitive?

7\. **\*\*Replay, Webhook Authenticity & Idempotency Check:\*\*** Can an unsigned, malformed, forged, tampered, stale, duplicate, concurrent, retried, or out-of-order webhook/payment event create state, bypass authentication, grant duplicate entitlement, regress authoritative state, or cause contradictory financial records? Where applicable, verify raw-body signature handling, provider event IDs, timestamp/freshness checks, atomic uniqueness, and business-level idempotency.

8\. **\*\*Failure-Mode Check:\*\*** If the database, cache, queue, AI provider, payment provider, storage provider, webhook source, or network fails, does the application fail closed where security or financial integrity requires it?

9\. **\*\*Abuse & Resource Exhaustion Check:\*\*** Can a user trigger unbounded memory, CPU, storage, database, AI-token, or network usage through large files, broad queries, recursive objects, websocket streams, or repeated expensive requests?

10\. **\*\*Secret/Prompt Boundary Check:\*\*** Could source code, PR text, uploaded content, user content, retrieved documents, or external responses manipulate an AI/tool agent into exposing secrets or bypassing policy?

11\. **\*\*Logging/Auditability Check:\*\*** Are security-significant actions attributable to an authenticated actor, tenant, resource, timestamp, and result without placing secrets or excessive sensitive data in logs?

12\. **\*\*Rollback/Recovery Check:\*\*** If the change fails after partial execution, can the system recover without data corruption, tenant crossover, orphaned records, or unreconciled financial state?

13\. **\*\*Secret Lifecycle & Rotation Check:\*\*** Are production credentials protected server-side, least-privileged, separated by environment where supported, absent from source/current and relevant Git history/client bundles/logs, revocable, and covered by a safe rotation procedure? If centralized secret management or automated rotation is proposed, does it add a justified benefit without creating an unverified availability dependency or unauthorized paid-service migration?

14\. **\*\*Error-Path Check:\*\*** What happens when validation, authorization, database, queue, storage, provider, network, or rendering fails? Does the user receive a safe actionable result, do security-sensitive checks fail closed, are retries safe, and is enough redacted diagnostic context preserved for operators?

15\. **\*\*Environment-Isolation Check:\*\*** Can development/test/staging code, credentials, seeders, migrations, webhooks, payment events, or automated agents read or mutate production resources unintentionally? Are production databases, payment state, credentials, storage, queues/caches, and customer data isolated as required?

16\. **\*\*Sensitive-Action Audit Check:\*\*** Can an investigator determine who or which service performed a privileged/security/financial/destructive action, against which tenant/resource, when, with what outcome, and correlate it to the originating request/provider event without relying on client-supplied identity or exposing prohibited sensitive data?



This self-audit is a defensive engineering review. It MUST NOT be represented as an independent external penetration test.



\---
