# M19 Financial integration and revenue compliance release gate

**Source sections:** GLOBAL:16, PAYMENT:GLOBAL-FINANCIAL-RELEASE-GATE  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**## 16. Financial Integration & Revenue Compliance Release Gate**



Do NOT mark a payment, subscription, billing, webhook, or revenue system **secure**, **complete**, **production-ready**, or **compliant** merely because checkout succeeds, a test charge succeeds, webhook JSON reaches the server, subscription creation works, a provider dashboard shows successful delivery, or a tax engine is enabled.



Before approval, verify as applicable:

\- all state-changing webhook/provider callback endpoints are inventoried;

\- provider-specific cryptographic verification is implemented;

\- raw-body handling is correct where required;

\- missing/invalid/mock verification secrets fail closed;

\- payment/API/webhook credentials are server-side protected, least-privileged where supported, revocable, and covered by a safe rotation procedure;

\- centralized secret-manager adoption is explicitly justified when needed and is not silently introduced as an unverified runtime dependency;

\- replay/freshness controls are implemented where supported;

\- event and business-level idempotency are concurrency-safe;

\- duplicate and out-of-order events cannot produce duplicate or regressive state;

\- amount/currency/customer/tenant/order/environment invariants are server-side verified;

\- financial state transitions are atomic and reconcilable;

\- unsigned, forged, tampered, stale, duplicate, concurrent, wrong-mapping, wrong-amount, wrong-currency, wrong-environment, and out-of-order negative tests have been executed where applicable;

\- tax exposure/registration/collection/filing responsibilities are assessed where multi-jurisdiction revenue applies;

\- product/service tax classification is intentional where applicable;

\- tax cannot be manipulated from client-controlled amounts or exemption flags;

\- filing/remittance ownership and deadlines are sourced from current authoritative information where applicable;

\- relevant unit/integration/security tests, typecheck/build/lint, dependency audit, and applicable CI gates were actually executed;

\- unresolved applicable Critical/High vulnerabilities and financial/compliance blockers are explicitly reported.

Report commands, pass/fail counts where available, exit codes where available, and unresolved blockers. Do not claim a check passed if it was not executed or supported by authoritative evidence.

A working integration is not proof of a secure integration. A configured tax engine is not proof of legal/tax compliance.


\---

# GLOBAL FINANCIAL RELEASE GATE

Do NOT mark a payment, subscription, billing, webhook, or revenue system:

- secure;
- complete;
- production-ready;
- verified;

merely because checkout works, a test charge succeeds, a webhook reaches the server, or a provider dashboard shows successful delivery.

Before approval, run the applicable:
- unit tests;
- integration tests;
- negative security tests;
- concurrent duplicate tests;
- replay tests;
- typecheck;
- build;
- lint;
- dependency security audit.

Report:
- command executed;
- pass/fail counts where available;
- exit codes where available;
- unresolved Critical/High dependency findings;
- remaining security/compliance blockers.

No unresolved applicable Critical/High vulnerability may be silently approved without mitigation or explicit risk acceptance.

A working integration is not proof of a secure integration.
A configured tax engine is not proof of tax compliance.
