# GLOBAL PAYMENT WEBHOOK SECURITY & REVENUE TAX COMPLIANCE DIRECTIVE

**Scope:** Applies to all repositories, services, agents, IDE workflows, APIs, payment integrations, subscription systems, SaaS products, marketplaces, and webhook consumers.

**Priority:** Mandatory global engineering guardrail.

**Operating rule:** FAIL CLOSED & PROVE.

Do not treat a working payment integration as a secure payment integration. Do not treat a configured tax provider as proof of legal compliance.

---

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

# PART B — REVENUE TAX / INDIRECT TAX COMPLIANCE

## B1. Terminology correction

The relevant term is **tax nexus**, not “NEXIS”.

Do not encode educational shorthand as legal truth.

Economic nexus, physical presence, VAT/GST registration, marketplace facilitator obligations, digital-service rules, and similar obligations vary by jurisdiction.

---

## B2. Never hard-code universal tax assumptions

Do not assume:
- `$100,000` is a universal threshold;
- `200 transactions` universally creates nexus;
- digital goods are always taxable;
- SaaS is always taxable;
- SaaS is always exempt;
- tax registration and tax collection are the same action;
- enabling Stripe Tax or another engine automatically completes legal registration;
- the seller is always the party responsible for remittance.

Thresholds, taxability, sourcing rules, filing obligations, and registration requirements must come from:
- authoritative government guidance;
- a reputable tax-compliance provider;
- current provider documentation;
- qualified professional advice where required.

Store source and last-verification date for material jurisdiction rules.

---

## B3. Maintain a jurisdiction exposure model

For jurisdictions relevant to the business, track:
- seller legal entity/location;
- customer jurisdiction;
- product/service classification;
- taxable sales;
- gross sales where applicable;
- transaction counts where relevant;
- B2B/B2C treatment;
- marketplace-facilitated sales;
- physical presence indicators;
- exemptions;
- refunds/credits;
- measurement period;
- current exposure;
- registration status;
- collection status;
- filing status.

Do not silently treat stale threshold data as authoritative.

---

## B4. Distinguish exposure from legal registration

Track separate states such as:
- no known obligation;
- approaching threshold;
- potential obligation;
- professional/legal review required;
- registration required;
- registration pending;
- registered;
- tax collection enabled;
- filing/remittance configured.

Do not automatically enable production tax collection merely because a threshold appears exceeded.

Do not automatically register with authorities without explicit authorization.

---

## B5. Product/service tax classification

Assign intentional tax classifications/codes where the chosen provider supports them.

Do not classify all:
- SaaS;
- digital goods;
- subscriptions;
- consulting/services;
- physical goods

the same merely for implementation convenience.

Material classification changes require review and tests.

---

## B6. Tax calculation must be authoritative server-side

Where collection is required and approved, determine tax using applicable:
- customer location;
- seller registration;
- product/service classification;
- exemption status;
- transaction type;
- jurisdiction rules.

Do not trust a client-submitted tax amount.

Prefer maintained tax engines/providers over hand-coded multi-jurisdiction tax-rate tables.

---

## B7. Customer location evidence

Where tax treatment depends on customer location, preserve the evidence required by the applicable jurisdiction/provider.

Possible evidence may include:
- billing address;
- payment-method country;
- delivery/service address;
- business location;
- tax ID;
- other legally relevant evidence.

Do not fabricate or silently choose location evidence when sources conflict.

Apply current provider/jurisdiction rules.

---

## B8. Exemptions and tax IDs

Do not grant exemptions because the client sends:

`taxExempt = true`

Validate exemptions server-side.

Retain required supporting evidence.

Where VAT/GST/business tax IDs affect treatment, validate them using an appropriate current authoritative/provider mechanism where required.

---

## B9. Refunds and tax adjustments

Refund workflows must keep:
- payment;
- tax collected;
- tax adjustment/reversal;
- refund;
- ledger/accounting records

consistent with the provider and applicable jurisdiction rules.

Do not refund principal while silently leaving tax records inconsistent.

---

## B10. Filing/remittance calendar

For every active tax registration, track:
- jurisdiction;
- legal entity;
- registration identifier;
- filing frequency;
- reporting period;
- filing deadline;
- remittance deadline;
- responsible person/provider;
- filing status;
- payment/remittance status.

Deadlines must come from current authoritative/provider sources.

Do not invent filing dates.

Generate alerts sufficiently before deadlines.

---

## B11. Reconciliation

Periodically reconcile:

`tax calculated`
vs.
`tax collected`
vs.
`refunds/adjustments`
vs.
`tax reported`
vs.
`tax remitted`

Surface discrepancies.

Maintain enough source data to reproduce reported figures.

---

## B12. Merchant-of-record / marketplace responsibility

Identify which party is legally responsible for tax collection and remittance.

Do not assume the application owner is always responsible.

Merchant-of-record, marketplace facilitator, reseller, platform, and agency arrangements may change responsibility.

Implementation must reflect the actual commercial/legal model.

---

# AI AGENT TAX SAFETY RULE

AI agents MAY:
- identify possible jurisdiction exposure;
- build tax dashboards;
- integrate approved tax providers;
- implement approved tax classifications;
- create alerts;
- build filing calendars;
- prepare reconciliation;
- retrieve current authoritative tax rules;
- flag uncertainty for review.

AI agents MUST NOT, without explicit authorization:
- register the company with a tax authority;
- enable new production tax jurisdictions;
- materially change product tax classifications;
- submit tax returns;
- remit tax funds;
- alter historical tax records;
- present uncertain legal conclusions as settled fact.

When legal/tax applicability is uncertain, state the uncertainty and require current authoritative verification or qualified review.

---

# REQUIRED TAX / REVENUE VERIFICATION

Before approving a revenue system for production or material geographic expansion, verify where applicable:

- business/seller legal model identified;
- merchant-of-record responsibility identified;
- customer-location rules defined;
- product/service tax classification defined;
- potential jurisdiction exposure assessed;
- registration state known where tax is collected;
- collection enabled only where authorized/appropriate;
- tax amount cannot be manipulated client-side;
- exemption workflows authenticated and auditable;
- refunds adjust tax records appropriately;
- filing/remittance responsibility documented;
- filing deadlines sourced from current authoritative data;
- tax reports reconcile to source transactions;
- stale hard-coded threshold/rate tables are not treated as authoritative.

---

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