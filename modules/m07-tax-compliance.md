# M07 Revenue tax and indirect-tax engineering guardrails

This is an engineering/compliance guardrail, not legal or tax advice.

## Controls
- Use accurate jurisdiction-specific terminology. Do not treat shorthand or educational examples as law.
- Never hard-code universal nexus thresholds, transaction counts, taxability, sourcing, registration, filing, or remittance assumptions.
- Maintain a jurisdiction exposure model where relevant: seller entity/location, customer location evidence, sales/transaction counts, product classification, B2B/B2C, marketplace treatment, physical presence, exemptions, refunds, measurement window, potential obligation, registration, collection, filing, and remittance.
- Material rules must cite current authoritative/reputable sources and last-verification dates. Stale tables are not authoritative.
- Distinguish exposure, legal review, registration required/pending/complete, collection enabled, and filing/remittance configured.
- Do not automatically register an entity, enable production tax jurisdictions, submit returns, remit funds, or alter historical tax records without explicit human authorisation and verified business facts.
- Assign intentional product/service tax classifications. Do not assume all SaaS, digital goods, subscriptions, consulting, or physical goods share one treatment.
- Calculate tax server-side using applicable seller registration, customer location, classification, exemptions, transaction type, and current jurisdiction rules. Never trust client tax amounts or exemption flags.
- Retain legally/provider-required customer location and exemption evidence. Do not fabricate evidence or silently choose conflicting signals.
- Keep payments, tax collected, tax adjustments, refunds, ledgers, reporting, and remittance reconciled.
- Track filing entity, jurisdiction, registration ID, frequency, reporting period, deadlines, responsible party, status, and payment/remittance status from current authoritative sources.
- Determine actual merchant-of-record/marketplace/reseller responsibility. Do not assume platform owner is always responsible.
- AI may identify exposure and prepare evidence, but must label uncertain applicability UNKNOWN / REQUIRES CURRENT AUTHORITATIVE OR QUALIFIED REVIEW.

## Source basis
Global directive Section 15 and Section 16; payment supplement Part B, AI Tax Safety Rule, and required tax/revenue verification.
