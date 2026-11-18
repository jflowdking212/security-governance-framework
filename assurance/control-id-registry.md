# USS control ID registry

This registry exposes one stable machine-readable **control-family ID per module**. It does not claim that every sentence or requirement inside a module has an individual sub-control ID. The IDs are references for assessment records, evidence reports and traceability. They do not prove implementation.

The authoritative mapping is [control-catalog.json](control-catalog.json). The catalog is validated against the module manifest and must contain exactly one unique family ID for each module.

| Module | Stable control-family ID | Scope |
|---|---|---|
| M01 | USS-ENG | Core operating policy and secure engineering |
| M02 | USS-AUTH | Authentication, passwords, MFA, recovery and sessions |
| M03 | USS-TEN | BOLA/IDOR, RBAC, ownership and tenant isolation |
| M04 | USS-INPUT | Injection, validation, output encoding, CSRF and file safety |
| M05 | USS-API | TLS, API hygiene, limits, abuse and transport |
| M06 | USS-PAY | Webhook authenticity, raw body, replay, idempotency and invariants |
| M07 | USS-TAX | Jurisdiction exposure, classification, location evidence, filing and reconciliation |
| M08 | USS-SECRET | Secret lifecycle, storage, access, rotation and revocation |
| M09 | USS-DATA | Privacy, protection, residency and data minimisation |
| M10 | USS-OPS | Errors, environment isolation, audit trails, monitoring and incident response |
| M11 | USS-AI | Prompt injection, tool boundaries, tenant isolation and model governance |
| M12 | USS-SUPPLY | CI/CD, infrastructure, dependencies and supply chain |
| M13 | USS-SELF | Mandatory in-line adversarial/self-audit vectors |
| M14 | USS-ASSURE | The 13-layer assurance model |
| M15 | USS-EVID | Production evidence, assurance pack and reporting |
| M16 | USS-TEST | Audit lifecycle and authorised penetration testing |
| M17 | USS-SEVERITY | Severity classification and release gates |
| M18 | USS-COMMS | Public security communication |
| M19 | USS-FIN | Financial integration and revenue release gate |
| M20 | USS-REMED | Audit-first, risk-based remediation and risk acceptance |
| M21 | USS-CORS | CORS and browser cross-origin trust boundaries |
| M22 | USS-AGENT | Agent execution contract |

## Evidence report enforcement

Use [security-evidence.example.json](../templates/security-evidence.example.json) as a structural template. Replace its example metadata and assess every control family in scope.

Run:

```sh
node tools/validate-evidence.mjs --file path/to/security-evidence.json
```

For a formal release-readiness assessment, include all 22 control families and run:

```sh
node tools/validate-evidence.mjs --file path/to/security-evidence.json --release
```

The validator checks that PASS controls have evidence, NOT_APPLICABLE controls have a rationale and approval, findings reference known controls, P0/P1 findings cannot be accepted, and P2/P3 risk acceptance is documented with an owner, rationale and expiry.

The computed state `READY_FOR_OWNER_REVIEW` is not production approval. It means only that the submitted evidence structure and declared statuses satisfy this validator. A human owner must still review the evidence and authorize release.

Do not invent control implementation status from this registry. Consult the authoritative module and verify application evidence.
