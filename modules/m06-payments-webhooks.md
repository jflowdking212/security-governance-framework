# M06 Payments, webhooks and external event integrity

**Source sections:** GLOBAL:1.E, PAYMENT:A1-A16, PAYMENT:WEBHOOK-NEGATIVE-TESTS  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**### E. Payment, Webhook & External Event Integrity**



\- **\*\*Authenticated Command Channel:\*\*** Treat every webhook as an externally reachable command channel, not as trusted notification data. A valid-looking JSON body, event name, customer ID, payment ID, subscription ID, tenant ID, or provider-style header is not proof of origin.

\- **\*\*Provider-Specific Verification:\*\*** Before any state-changing side effect, verify the webhook using the provider's documented cryptographic mechanism and, where available, the provider's maintained SDK/library. Do not assume Stripe, Paystack, Flutterwave, GitHub, Clerk/Svix, Shopify, or other providers use interchangeable signature algorithms, headers, canonicalization rules, timestamp formats, retry semantics, or event identifiers.

\- **\*\*Webhook Inventory:\*\*** Audit the entire application for inbound webhooks, callbacks, notification URLs, payment/subscription callbacks, identity events, repository hooks, asynchronous provider notifications, and event receiver routes. For each, document provider, route, authentication/signature method, secret/config variable, event/delivery ID, freshness mechanism where supported, idempotency strategy, permitted event types, environment, tenant/resource mapping, and business side effects.

\- **\*\*Raw-Body Integrity:\*\*** If a provider signs the raw request body, signature verification MUST receive the exact provider-required bytes before JSON parsing or middleware mutation. Do not reserialize, normalize, reorder, re-encode, or otherwise alter a signed payload before verification. Explicitly verify middleware/proxy behavior.

\- **\*\*Verification Order:\*\*** The required flow is: receive request → preserve provider-required raw payload → obtain signature/authentication headers → verify required secret/config exists → cryptographically verify signature → validate timestamp/freshness where supported → validate provider account/environment → validate event allowlist → enforce replay/idempotency protection → validate business invariants → durably record/queue processing → perform side effects → acknowledge according to provider semantics. No irreversible or entitlement-changing business action may execute before authentication succeeds.

\- **\*\*Fail Closed on Secrets:\*\*** Missing, empty, malformed, placeholder/mock, wrong-environment, or unavailable production webhook verification material MUST reject protected processing. Never implement `if secret exists -> verify; otherwise -> trust`. If a real production signing secret was committed to source control, treat it as compromised and rotate/revoke it.

\- **\*\*Replay/Freshness Protection:\*\*** Where the provider supplies signed timestamps, timestamps, nonces, delivery IDs, or equivalent freshness controls, validate them using provider guidance. Do not disable timestamp/recency checking merely to make tests pass. Keep server clocks synchronized where freshness validation depends on time.

\- **\*\*Atomic Event Idempotency:\*\*** Assume legitimate events can be redelivered. Persist provider event/delivery identifiers and enforce concurrency-safe uniqueness such as `(provider, event_id)` with a database UNIQUE constraint, transactional insert, atomic upsert, or equivalent. A naive `SELECT -> if absent -> process -> INSERT` sequence is insufficient without a concurrency-safe uniqueness guarantee.

\- **\*\*Business-Level Idempotency:\*\*** Event-ID deduplication alone may be insufficient when different provider events represent the same logical financial transition. Enforce domain invariants such as one entitlement grant per paid invoice, one credit issuance per transaction, one subscription activation per authoritative object/state, one refund application per refund ID, and one ledger posting per source transaction.

\- **\*\*Duplicate Acknowledgement:\*\*** An already authenticated and successfully processed duplicate must cause zero duplicate business side effects. Where provider semantics expect acknowledgement, normally return the provider-appropriate success response rather than intentionally triggering repeated retries solely because the event was already processed.

\- **\*\*Out-of-Order Delivery:\*\*** Do not assume webhook delivery order unless the provider explicitly guarantees it. Handlers must tolerate delayed, reordered, retried, and duplicate events. A stale event must not regress authoritative state. Retrieve current provider-side state server-side when necessary.

\- **\*\*Business-Invariant Verification:\*\*** A valid signature establishes provider origin/integrity; it does not by itself authorize every application-side action. Before payment, refund, provisioning, entitlement, subscription, balance, or role changes, verify applicable provider account, live/test environment, customer, tenant/company, internal order mapping, amount, currency, product/price, payment state, entitlement, and current state transition. Client-supplied price, tenant, owner, role, entitlement, payment status, or subscription tier must never be the sole authority.

\- **\*\*Event Allowlist:\*\*** Subscribe to and process only required event types. Unknown or unexpected events must not enter generic state-changing fallbacks. A new event type requires intentional implementation and tests.

\- **\*\*Transactional Safety:\*\*** Financial side effects and idempotency state must remain correct under concurrent delivery, retries, process crashes, database failures, queue retries, and network timeouts. Use appropriate transactions, locks, uniqueness constraints, compare-and-set logic, and outbox/queue patterns rather than assuming exactly-once network delivery.

\- **\*\*Asynchronous Work:\*\*** Where provider semantics permit, keep the synchronous handler limited to authentication, security validation, idempotency establishment, and durable acceptance; queue expensive downstream work. Do not acknowledge unauthenticated requests merely to suppress retries.

\- **\*\*Defense in Depth:\*\*** Use HTTPS, request-size limits, narrow HTTP methods, minimal event subscriptions, provider IP filtering where supported, rate/abuse controls, and network restrictions where operationally appropriate. These controls supplement cryptographic verification; they do not replace it.

\- **\*\*Secret Rotation:\*\*** Support safe signing-secret rotation without disabling verification. Where a provider supports overlapping old/new secrets, accept both only for the documented transition period and remove expired secrets promptly.

\- **\*\*Webhook Observability:\*\*** Log provider, event ID, event type, receipt time, verification result, duplicate status, mapped internal object, processing outcome, and failure category where appropriate. Never log signing secrets, API secret keys, authorization credentials, full sensitive payment data, or unnecessary personal information.

\- **\*\*Mandatory Negative Verification for Security-Critical Webhooks:\*\*** Execute applicable tests for unsigned requests, missing signatures, malformed signatures, forged signatures, tampered payloads, missing/mock production secrets, stale signed requests where freshness is supported, duplicate deliveries, concurrent duplicates, multi-worker races, wrong amount/currency/customer/tenant/order mapping, test-mode events against production state, unknown event types, out-of-order delivery, raw-body mutation, and retry after partial failure. Do not report webhook security as passed unless the relevant tests were actually executed or supported by authoritative evidence.

# PART A — PAYMENT & WEBHOOK SECURITY

## A1. Webhooks are authenticated command channels

Treat every webhook as an externally reachable command interface.

Never execute business logic merely because:
- the JSON structure is valid;
- the event name is expected;
- the payload contains a valid-looking payment, user, order, subscription, tenant, or repository ID;
- the request claims to come from a known provider;
- the request includes provider-looking headers.

Before any state-changing action, cryptographically verify the webhook using the provider's documented mechanism.

Examples include Stripe, Paystack, Flutterwave, GitHub, Clerk/Svix, Shopify, billing providers, identity providers, email providers, and other third-party event sources.

Provider implementations MUST remain provider-specific. Do not assume all providers use the same algorithm, signature header, canonicalization, timestamp scheme, retry policy, or event identifier.

---

## A2. Audit every inbound webhook/callback

Search the entire application for:
- `/webhook` routes;
- callbacks;
- notification URLs;
- payment callbacks;
- subscription callbacks;
- identity/account events;
- OAuth provider callbacks that cause state changes;
- SCM/repository hooks;
- asynchronous provider notifications;
- queue ingress endpoints;
- event receiver routes.

For each endpoint document:
- provider;
- route;
- purpose;
- authentication/signature method;
- secret/config variable;
- event or delivery ID;
- timestamp/freshness mechanism where supported;
- idempotency strategy;
- permitted event types;
- business side effects;
- test/live environment separation.

Every state-changing inbound provider event MUST have an explicit authentication strategy.

---

## A3. Verify signature before parsing-driven business logic

Required order:

1. Receive request.
2. Preserve provider-required raw/original request bytes.
3. Read signature/authentication headers.
4. Confirm required secret/config exists.
5. Verify signature using provider-recommended SDK/library where available.
6. Validate signed timestamp/freshness where supported.
7. Validate environment/account/provider context.
8. Validate event type allowlist.
9. Enforce replay/idempotency protection.
10. Validate business invariants.
11. Commit durable processing state.
12. Perform or enqueue business action.
13. Return provider-appropriate acknowledgement.

No provisioning, entitlement, role change, order completion, refund, subscription change, credit issuance, balance adjustment, or financial state mutation may happen before authentication succeeds.

---

## A4. Preserve raw webhook body

If the provider signs the raw body, verify against the exact bytes received.

Do not:
- parse and reserialize JSON before verification;
- normalize whitespace;
- reorder fields;
- modify encoding;
- mutate newlines;
- run middleware that changes the signed bytes before verification.

Explicitly review middleware order.

Framework defaults are not proof that raw-body verification is correct.

---

## A5. Fail closed on missing or invalid webhook secrets

Production webhook secrets are mandatory configuration.

If a required secret is:
- missing;
- empty;
- malformed;
- placeholder/mock;
- wrong-environment;
- unavailable due to config-loading failure;

then reject processing.

Forbidden pattern:

`if (secret) verify(); else trustRequest();`

Missing verification configuration MUST disable the protected webhook path, not downgrade it to unsigned processing.

Never commit webhook secrets, API keys, private keys, or production credentials to source control.

If a real secret was committed, treat it as compromised and rotate/revoke it.

---

## A6. Replay protection

Signature verification alone may not prevent replay.

Where supported, validate:
- signed timestamps;
- freshness windows;
- nonces;
- provider delivery IDs;
- event IDs.

Reject stale signed requests outside the provider-recommended or explicitly justified tolerance.

Do not disable timestamp checks merely to make tests pass.

Ensure server time is reliably synchronized.

---

## A7. Atomic idempotency

Assume providers may redeliver legitimate events.

Persist processed event/delivery IDs.

Preferred uniqueness key:

`provider + event_id`

Use a database UNIQUE constraint, transactional insert, atomic upsert, or equivalent concurrency-safe mechanism.

Do NOT rely on:

`SELECT -> if missing -> process -> INSERT`

without a concurrency-safe uniqueness guarantee.

Two concurrent workers processing the same event MUST produce one business effect.

A valid duplicate that was already processed should normally:
- perform zero additional business actions;
- return the provider-appropriate success acknowledgement where appropriate.

Do not intentionally cause endless retries by treating every legitimate duplicate as an error.

---

## A8. Business-level idempotency

Event-ID deduplication may be insufficient if multiple provider events can represent the same logical business transition.

Where relevant, also enforce a domain invariant such as:
- one entitlement grant per paid invoice;
- one credit issuance per transaction;
- one subscription activation per authoritative provider object/version;
- one refund application per refund ID;
- one ledger posting per financial source event.

Financial side effects must remain safe under retries and concurrency.

---

## A9. Do not assume event ordering

Webhook delivery order is not guaranteed unless the provider explicitly guarantees it.

Handlers must tolerate:
- delayed events;
- reordered events;
- retries;
- duplicate events;
- crash/restart conditions.

A stale event must not regress authoritative state.

Example:
A delayed `pending` event must not overwrite a payment already recorded as `paid` when the provider's current authoritative state says otherwise.

Fetch authoritative provider state server-side when necessary.

---

## A10. Verify business invariants after signature verification

A valid provider signature proves origin/authenticity of the event. It does NOT automatically prove the intended business action is correct.

Validate applicable invariants, including:
- provider account;
- environment/test-vs-live mode;
- internal customer mapping;
- tenant/company ownership;
- order/subscription mapping;
- expected product/price;
- amount;
- currency;
- payment status;
- entitlement being purchased;
- refund target;
- current state transition.

Never trust client-supplied:
- price;
- amount;
- tenant ID;
- owner ID;
- role;
- entitlement;
- payment status;
- tax exemption flag;
- subscription tier

as the sole authority for a financial or authorization decision.

---

## A11. Event allowlisting

Process only event types the application explicitly supports.

Unknown/unhandled event types must not fall into generic state-changing logic.

Adding a new event type requires intentional implementation and tests.

---

## A12. Transactional safety

Webhook workflows must remain correct under:
- duplicate delivery;
- concurrent delivery;
- worker retry;
- queue retry;
- process crash;
- database failure;
- provider retry;
- network timeout.

Where possible, commit financial state and idempotency state atomically.

For cross-system workflows, use an appropriate transactional/outbox/queue pattern rather than assuming exactly-once network delivery.

---

## A13. Asynchronous processing

Webhook endpoints should usually perform only enough synchronous work to:
- authenticate;
- validate;
- establish idempotency;
- durably accept the event.

Expensive downstream work should normally be queued.

Do not acknowledge unauthenticated requests merely to suppress provider retries.

---

## A14. Defense in depth

Where supported and operationally appropriate, use:
- HTTPS;
- valid TLS;
- request-size limits;
- provider IP filtering;
- rate limits/abuse controls;
- allowed HTTP methods only;
- narrow event subscriptions;
- network restrictions.

These controls supplement cryptographic verification.

They do NOT replace it.

---

## A15. Secret rotation

Webhook secret rotation must not require disabling verification.

Where the provider supports overlapping old/new secrets, accept both only during the documented transition window.

Remove expired secrets promptly.

Rotate any suspected-compromised webhook secret.

---

## A16. Logging and observability

Log enough metadata for incident reconstruction:
- provider;
- event ID;
- event type;
- receive time;
- verification outcome;
- duplicate status;
- internal object ID;
- processing result;
- failure category.

Never log:
- signing secrets;
- API secret keys;
- authorization tokens;
- full sensitive payment data;
- unnecessary personal information.

Signature failures, malformed requests, replay attempts, and duplicate floods should be observable.

---

# REQUIRED WEBHOOK NEGATIVE TESTS

Where applicable, execute and record results for:

- unsigned webhook -> REJECT
- missing signature -> REJECT
- malformed signature -> REJECT
- forged signature -> REJECT
- valid signature over different/tampered body -> REJECT
- missing production secret -> FAIL CLOSED
- mock/placeholder secret in production -> FAIL CLOSED
- stale signed event -> REJECT where provider supports freshness checking
- duplicate event -> ONE business effect
- concurrent duplicate events -> ONE business effect
- same event handled by multiple workers -> ONE business effect
- wrong amount -> NO unauthorized entitlement
- wrong currency -> NO unauthorized entitlement
- wrong tenant/customer/order mapping -> NO unauthorized entitlement
- test-mode event against production records -> NO production side effect
- unknown event type -> NO generic mutation
- out-of-order event sequence -> authoritative final state preserved
- raw-body parser mutation -> signature verification must fail or receive original bytes correctly
- retry after process crash -> correct idempotent recovery

Do not declare webhook handling secure until applicable negative tests have actually been executed.

---
