# USS module index

Read `KERNEL.md` first, then load only the module for the current task and its dependencies. Use `node tools/resolve-task.mjs --task <key>` to print the exact list.

| ID | Module | Typical use |
|---|---|---|
| M01 | [Core operating policy and secure engineering](modules/m01-engineering-workflow.md) |  |
| M02 | [Authentication, identity and sessions](modules/m02-authentication-sessions.md) | M01, M08 |
| M03 | [Authorisation, roles and tenant isolation](modules/m03-authorization-tenancy.md) | M01, M02 |
| M04 | [Injection, input validation and client security](modules/m04-input-injection-web.md) | M01, M03 |
| M05 | [Network, transport and API hygiene](modules/m05-api-network-transport.md) | M01, M04 |
| M06 | [Payments, webhooks and external event integrity](modules/m06-payments-webhooks.md) | M01, M03, M04, M05, M08, M10 |
| M07 | [Revenue tax and indirect-tax compliance](modules/m07-tax-compliance.md) | M01, M06, M09 |
| M08 | [Secrets, credentials and lifecycle management](modules/m08-secrets.md) | M01 |
| M09 | [Data protection, privacy and residency](modules/m09-data-protection.md) | M01, M03, M08 |
| M10 | [Operations, environment isolation, audit and incident response](modules/m10-operations-audit-ir.md) | M01, M08, M09 |
| M11 | [AI/LLM security and governance](modules/m11-ai-llm-security.md) | M01, M03, M08, M09, M10 |
| M12 | [CI/CD, infrastructure and software supply chain](modules/m12-supply-chain-cicd-infra.md) | M01, M08, M10 |
| M13 | [Mandatory in-line penetration self-audit](modules/m13-self-audit.md) | M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12 |
| M14 | [13-layer production security assurance model](modules/m14-assurance-model.md) | M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12 |
| M15 | [Production evidence, assurance pack and reporting](modules/m15-evidence-reporting.md) | M14 |
| M16 | [Audit, remediation and authorised penetration testing](modules/m16-audit-penetration-testing.md) | M13, M14, M15, M17 |
| M17 | [Security finding severity and release gates](modules/m17-severity-release-gates.md) | M14, M15 |
| M18 | [Public security communication](modules/m18-public-security-communication.md) | M10, M15, M17 |
| M19 | [Financial integration and revenue compliance release gate](modules/m19-financial-release-gate.md) | M06, M07, M08, M09, M15, M17 |
| M20 | [Audit-first, risk-prioritised engineering and remediation](modules/m20-audit-first-remediation.md) | M13, M14, M15, M16, M17 |
| M21 | [CORS and browser cross-origin trust boundary](modules/m21-cors-browser-boundary.md) | M04, M05 |
| M22 | [Agent execution contract and policy adherence](modules/m22-agent-execution-contract.md) | M01 |

## Task keys
- `authentication`: M02
- `authorization`: M03
- `input-security`: M04
- `api-security`: M05, M21
- `payments`: M06, M19
- `tax-compliance`: M07, M19
- `secrets`: M08
- `data-protection`: M09
- `operations`: M10
- `ai-security`: M11
- `supply-chain-cicd`: M12
- `security-audit`: M13, M14, M15, M16, M17, M20
- `public-security-communication`: M18
- `agent-execution`: M22
- `full-audit`: M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12, M13, M14, M15, M16, M17, M18, M19, M20, M21, M22

Dependencies are transitive and mandatory. A module may require other modules even when the task appears narrow. Full audit means all modules and all 13 assurance layers.
