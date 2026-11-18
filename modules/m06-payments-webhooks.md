# M06 Payments, financial integrity and webhooks

**Operating rule: FAIL CLOSED & PROVE.** A successful checkout or provider dashboard delivery is not proof of secure payment processing.

## Webhook controls
- Treat every inbound webhook/callback as an externally reachable authenticated command channel.
- Inventory all webhook, callback, notification, OAuth state-change, queue-ingress, and provider event routes. Record provider, route, signature scheme, secret, event ID, freshness, idempotency, allowlisted events, environment, tenant mapping, and side effects.
- Use provider-specific documented cryptographic verification and maintained SDKs where available. Never assume providers share signature algorithms, headers, canonicalisation, timestamps, retries, or event identifiers.
- Preserve exact raw request bytes when the provider signs the raw body. Verify before parsing-driven business logic or state-changing side effects.
- Missing, empty, malformed, placeholder, unavailable, or wrong-environment production secrets must fail closed. Never fall back to trusting unsigned requests.
- Validate signed timestamp/freshness, nonce/delivery ID, provider account, and test/live environment as supported.
- Enforce concurrency-safe event idempotency using a unique key such as provider + event ID, with transactional insert/upsert or equivalent. A SELECT-then-INSERT sequence alone is insufficient.
- Enforce business-level idempotency: one entitlement per paid invoice, one refund application per refund ID, one ledger posting per source transaction, and equivalent domain invariants.
- Tolerate duplicate, delayed, reordered, retried, concurrent, and out-of-order delivery. A stale event must not regress authoritative state. Retrieve provider state when necessary.
- Allowlist supported event types. Unknown events must not trigger generic state changes.
- Validate provider account, environment, customer, tenant, order, amount, currency, product, payment state, refund target, and permitted transition server-side.
- Use transactions, uniqueness constraints, locks, compare-and-set, and outbox/queue patterns as appropriate. Acknowledge duplicates according to provider semantics after safe authentication.
- Keep synchronous webhook handlers narrow: authenticate, validate, establish idempotency, durably accept; queue expensive work where appropriate.
- HTTPS, request bounds, rate limits, IP filters, and narrow subscriptions are defence in depth, not signature substitutes.
- Rotate secrets safely. If a real secret was committed, treat it as compromised and rotate/revoke through an authorised process.
- Log provider, event ID/type, time, verification, duplicate status, internal reference, and result. Never log secrets, tokens, or unnecessary sensitive payment data.

## Financial integrity
- Use integer minor units or fixed/decimal precision, never floating point for money.
- Make payment, refund, subscription, entitlement, balance, ledger, and reconciliation transitions atomic and auditable.
- Never trust client-supplied amount, currency, price, payment state, customer, tenant, entitlement, role, or tax exemption as sole authority.
- Reconcile provider state, internal orders, ledger, refunds, and entitlements. Surface discrepancies.
- Separate test and live credentials, endpoints, events, and records.

## Required negative tests
Unsigned/missing/malformed/forged/tampered signature; missing production secret; stale event; duplicate and concurrent duplicate; multi-worker duplicate; wrong amount/currency/customer/tenant/order/account/environment; unknown event; out-of-order event; raw-body mutation; process crash/retry; and provider outage. Each applicable test must show no unauthorised side effect.

## Release gate
Do not call a financial integration secure, complete, production-ready, or compliant until applicable verification, negative tests, reconciliation, dependency checks, and unresolved Critical/High blockers are reported with evidence.

## Source basis
Global directive Sections 1.A, 1.E, 1.F, 7, 15-17; payment supplement Parts A and required negative tests.
