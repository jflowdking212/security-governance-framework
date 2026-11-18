# Data lifecycle and privacy supplement

**Status:** Supplemental engineering guidance, not a legal opinion or compliance certification  
**Applies to:** Personal data, sensitive data, financial records, user uploads, analytics, logs, backups, AI prompts and third-party processing  
**Related modules:** M09, M10, M11  
**Reviewed:** 2026-11-18

M09 is intentionally source-faithful and contains the data-protection and database-integrity checks present in the preserved directives. This supplement adds a practical lifecycle model without rewriting the canonical source.

## Data inventory and purpose

- Maintain an inventory of data categories, data subjects, systems, databases, object stores, logs, analytics, caches, search indexes, backups, AI systems, subprocessors and international transfers.
- Record the purpose for each category, the minimum fields required, the system owner, access roles, retention trigger and deletion method.
- Identify sensitive or special-category data and apply stronger access, logging, encryption and retention controls according to the applicable law and threat model.
- Do not collect data merely because a field might be useful later. Prefer anonymous or pseudonymous data when identification is not required.
- Keep production data out of development, test prompts and support tools unless there is a documented need and approved safeguards.

## Privacy by design and default

- Define the purpose and applicable lawful basis before collecting or reusing personal data. Consent is not a universal substitute for determining the correct lawful basis.
- Make privacy-protective settings the default. Restrict optional sharing, public visibility, tracking and data export unless a user deliberately enables them.
- Provide clear notices about what is collected, why, how long it is kept, who receives it and how users can exercise applicable rights.
- Assess high-risk processing, profiling, large-scale sensitive data and new AI uses before launch. Obtain qualified privacy/legal review when a formal impact assessment or consultation may be required.
- Review data flows and subprocessors before enabling new integrations or sending personal data to an external AI or analytics provider.

## Retention, deletion and restoration

- Define retention periods by record category and business/legal purpose. Avoid indefinite retention by default.
- Automate expiry and deletion where possible, and run periodic reports for records that have exceeded their approved retention period.
- Implement deletion across primary databases, object stores, search indexes, caches, derived datasets and third-party processors where the architecture and law require it.
- Document backup retention and deletion semantics. If a backup cannot be selectively edited, define an expiry window, access restrictions and a restore procedure that reapplies deletion tombstones or equivalent controls before the restored system is exposed.
- Distinguish deletion from disabling access or moving data offline. Pseudonymised data may still be personal data if it can be re-linked.
- Preserve records that must legally be retained, but restrict access and document the retention basis and expiry review.

## Access, sharing and audit

- Enforce least-privilege access and tenant boundaries at every service and data store.
- Log access to sensitive records and privileged data exports where proportionate. Do not log full personal records, credentials, tokens or unnecessary identifiers.
- Encrypt sensitive data in transit and at rest according to the threat model. Keep key material separate from the data it protects.
- Maintain a record of processors, subprocessors, data locations, transfer mechanisms and contract/security reviews.
- Provide a controlled workflow for access, correction, deletion, objection and portability requests where required by applicable law. Verify the requester without collecting excessive additional data.
- Build incident procedures that identify affected data categories, data subjects, systems, processors, jurisdictions and notification deadlines. Do not invent a universal deadline.

## Jurisdictional applicability

The Nigeria Data Protection Act 2023 has an application section covering specified connections to Nigeria, including controllers or processors domiciled, resident or operating in Nigeria, processing within Nigeria, and certain processing of data subjects in Nigeria by organisations outside Nigeria. Determine applicability from the current official Act and regulations for the actual organisation and processing activity.

Other laws may also apply based on establishment, users, processing location, sector and data type. Do not assume GDPR, NDPA or any other regime applies solely because a user or server is in a particular country. Do not make a compliance claim without current legal review and evidence.

## Verification checklist

- Data inventory and purpose map are current.
- Each data category has an owner, lawful-basis assessment, access model and retention rule.
- Unnecessary collection and broad exports are blocked.
- Deletion tests cover replicas, indexes, caches, derived data and processor workflows.
- Backup restoration does not silently reintroduce data that should remain deleted.
- Logs, traces, analytics and AI prompts are reviewed for sensitive-data leakage.
- Cross-tenant and cross-environment data access tests are executed.
- Data subject request and incident workflows are exercised using test data.

## Primary references

- [Nigeria Data Protection Act 2023 - Nigeria Data Protection Commission](https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf)
- [Nigeria Data Protection Act General Application and Implementation Directive 2025](https://ndpc.gov.ng/wp-content/uploads/2025/03/NDP-ACT-GAID-2025-MARCH-20TH.pdf)
- [European Commission: Principles of the GDPR](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

This document is engineering guidance. Obtain qualified advice for legal applicability, retention duties, international transfers and notification obligations.
