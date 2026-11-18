# M07 Revenue tax and indirect-tax compliance

**Source sections:** GLOBAL:15, PAYMENT:PREAMBLE, PAYMENT:B1-B12, PAYMENT:AI-TAX-SAFETY, PAYMENT:TAX-VERIFICATION
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**Scope:** Applies to all repositories, services, agents, IDE workflows, APIs, payment integrations, subscription systems, SaaS products, marketplaces, and webhook consumers.

**Priority:** Mandatory global engineering guardrail.

**Operating rule:** FAIL CLOSED & PROVE.

Do not treat a working payment integration as a secure payment integration. Do not treat a configured tax provider as proof of legal compliance.

**## 15. Revenue Tax & Indirect Tax Compliance Guardrail**



This section is an engineering/compliance guardrail, not a substitute for legal or tax advice. Tax configuration is not automatically an application-security control, but revenue systems can create material legal, financial, accounting, and operational liabilities when tax obligations are ignored or implemented from unsupported assumptions.



**### A. Terminology & Accuracy**



\- The relevant US concept is generally **economic nexus** or **tax nexus**, not “NEXIS.”

\- Never encode educational shorthand or a mentor/social-media example as binding legal truth without current authoritative verification.

\- Do not assume all US states use `$100,000`, `200 transactions`, “first-dollar digital goods,” or any other universal threshold. Threshold amounts, transaction-count tests, included/excluded sales, measurement periods, product taxability, sourcing rules, and registration obligations vary and can change.

\- Do not generalize US state sales-tax concepts to VAT, GST, or other jurisdictions. Apply the legal model relevant to the seller, customer, product/service, and jurisdiction.



**### B. Jurisdiction Exposure Model**



Where a product collects revenue across jurisdictions, maintain or integrate a current exposure model that can track, as applicable:

\- seller legal entity and relevant business locations;

\- customer jurisdiction/location evidence;

\- gross and/or taxable sales as required by the applicable rule;

\- transaction counts where relevant;

\- product/service tax classification;

\- B2B/B2C treatment;

\- marketplace-facilitated or merchant-of-record transactions;

\- physical-presence indicators;

\- exemptions and validated tax IDs where applicable;

\- refunds/credits;

\- threshold measurement window;

\- potential obligation status;

\- registration status;

\- collection status;

\- filing/remittance status.

Material threshold/rule data MUST carry an authoritative/reputable source and a last-verification date. Do not silently treat stale hard-coded threshold tables as current law.



**### C. Distinguish Exposure, Registration, Collection & Filing**



Track separate states such as:

`no known obligation -> approaching threshold -> potential obligation/review -> registration required -> registration pending -> registered -> collecting -> filing/remittance configured`

Do not equate:

\- crossing or approaching a software-estimated threshold with a final legal conclusion;

\- creating a tax-provider configuration object with completing government registration;

\- enabling tax calculation with authorization to collect in every jurisdiction;

\- collecting tax with filing/remittance completion.

Do not automatically register a company with a tax authority, enable a new production tax jurisdiction, submit a return, remit funds, or alter historical tax records without explicit authorization and verified business/compliance information.



**### D. Product/Service Tax Classification**



Use intentional tax classifications/codes where supported. Do not classify all SaaS, digital goods, subscriptions, consulting/services, or physical goods identically merely for implementation convenience.

Material classification changes that affect customer charges or reporting require review, test coverage, and auditable change history.



**### E. Authoritative Tax Calculation**



Where collection is required and approved, tax calculation must use applicable authoritative data such as seller registration, customer location, product/service classification, exemption status, transaction type, and current jurisdiction rules.

Do not trust a client-submitted tax amount or `taxExempt` flag as authoritative.

For broad multi-jurisdiction deployments, prefer a maintained tax engine/compliance provider or authoritative jurisdiction rules over hand-coded rate/threshold tables.



**### F. Customer Location & Exemption Evidence**



Where tax treatment depends on customer location or status, retain the evidence required by the applicable provider/jurisdiction, which may include billing/service address, payment-method country, business location, tax ID, validated exemption documentation, or other relevant evidence.

Do not fabricate location evidence or silently choose whichever conflicting signal produces a preferred tax result.

Tax exemptions and business tax IDs must be validated server-side using the applicable authoritative/provider process where required.



**### G. Refunds, Credits & Reconciliation**



Refund and credit workflows must keep payment, tax collected, tax adjustment/reversal, refund, invoice/ledger, and reporting records consistent with provider and jurisdiction requirements.

Periodically reconcile:

`tax calculated -> tax collected -> refunds/adjustments -> tax reported -> tax remitted`

Surface discrepancies rather than silently ignoring them. Preserve sufficient transaction/audit evidence to reproduce reported figures.



**### H. Filing & Remittance Calendar**



For active registrations, track the applicable jurisdiction, legal entity, registration identifier, filing frequency, reporting period, filing deadline, remittance deadline, responsible person/provider, filing status, and payment/remittance status.

Deadlines and filing frequencies must come from current authoritative/provider sources. Do not invent filing dates.



**### I. Merchant-of-Record / Marketplace Responsibility**



Determine which party is legally responsible for tax calculation, collection, filing, and remittance. Do not assume the application owner is always the responsible seller. Merchant-of-record, marketplace facilitator, reseller, platform, and agency arrangements can materially change responsibilities.



**### J. AI Tax Safety Rule**



AI agents MAY identify potential exposure, build tax dashboards/calendars, integrate approved tax tooling, implement approved classifications, reconcile records, retrieve current authoritative rules, and flag uncertainty.

AI agents MUST NOT independently invent a legal conclusion and silently change production tax behavior. When applicability is uncertain, mark it **UNKNOWN / REQUIRES CURRENT AUTHORITATIVE OR QUALIFIED REVIEW** rather than presenting a guess as compliance.



\---

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
