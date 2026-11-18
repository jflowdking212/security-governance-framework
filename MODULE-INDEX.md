# USS module index

Read `KERNEL.md` first, then load only the module for the current task and its dependencies. Use `node tools/resolve-task.mjs --task <key>` to print the exact list.

| ID | Module | Trigger terms | Dependencies | File |
|---|---|---|---|---|
| M01 | Core operating policy and secure engineering | core, secure-engineering, development, code-change, review | None | `modules/m01-engineering-workflow.md` |
| M02 | Authentication, identity and sessions | authentication, login, password, mfa, otp, session, recovery, invite | M01, M08 | `modules/m02-authentication-sessions.md` |
| M03 | Authorisation, roles and tenant isolation | authorization, authorisation, rbac, abac, tenant, tenancy, saas, ownership, hierarchy, bola, idor | M01, M02 | `modules/m03-authorization-tenancy.md` |
| M04 | Injection, input validation and client security | input, validation, injection, sql, nosql, command, xss, csrf, ssrf, file-upload, browser | M01, M03 | `modules/m04-input-injection-web.md` |
| M05 | Network, transport and API hygiene | api, network, transport, tls, http, websocket, rate-limit, cors | M01, M04 | `modules/m05-api-network-transport.md` |
| M06 | Payments, webhooks and external event integrity | payment, payments, webhook, billing, subscription, invoice, refund, financial, provider-event | M01, M03, M04, M05, M08, M10 | `modules/m06-payments-webhooks.md` |
| M07 | Revenue tax and indirect-tax compliance | tax, vat, gst, sales-tax, nexus, tax-compliance, filing, remittance | M01, M06, M09 | `modules/m07-tax-compliance.md` |
| M08 | Secrets, credentials and lifecycle management | secrets, credentials, keys, tokens, rotation, environment, secret-manager | M01 | `modules/m08-secrets.md` |
| M09 | Data protection, privacy and residency | data, privacy, database, storage, retention, encryption, backup, export, integrity | M01, M03, M08 | `modules/m09-data-protection.md` |
| M10 | Operations, environment isolation, audit and incident response | errors, logging, monitoring, audit, incident, response, availability, resilience, recovery, environment | M01, M08, M09 | `modules/m10-operations-audit-ir.md` |
| M11 | AI/LLM security and governance | ai, llm, prompt-injection, agents, tools, retrieval, embeddings, model | M01, M03, M08, M09, M10 | `modules/m11-ai-llm-security.md` |
| M12 | CI/CD, infrastructure and software supply chain | dependencies, supply-chain, cicd, ci, cd, infrastructure, hosting, deployment, build, release, sbom | M01, M08, M10 | `modules/m12-supply-chain-cicd-infra.md` |
| M13 | Mandatory in-line penetration self-audit | self-audit, negative-tests, fuzzing, security-checklist, adversarial-tests | M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12 | `modules/m13-self-audit.md` |
| M14 | 13-layer production security assurance model | assurance, security-audit, production-readiness, 13-layer, apes | M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12 | `modules/m14-assurance-model.md` |
| M15 | Production evidence, assurance pack and reporting | evidence, reporting, audit-pack, security-questionnaire, procurement | M14 | `modules/m15-evidence-reporting.md` |
| M16 | Audit, remediation and authorised penetration testing | penetration-test, pentest, audit-lifecycle, remediation, retest | M13, M14, M15, M17 | `modules/m16-audit-penetration-testing.md` |
| M17 | Security finding severity and release gates | severity, p0, p1, release-gate, risk-acceptance | M14, M15 | `modules/m17-severity-release-gates.md` |
| M18 | Public security communication | security-disclosure, public-security, security-claims, incident-communications | M10, M15, M17 | `modules/m18-public-security-communication.md` |
| M19 | Financial integration and revenue compliance release gate | financial-release, payment-release, reconciliation-gate | M06, M07, M08, M09, M15, M17 | `modules/m19-financial-release-gate.md` |
| M20 | Audit-first, risk-prioritised engineering and remediation | risk-prioritization, remediation-register, root-cause, risk-acceptance-process | M13, M14, M15, M16, M17 | `modules/m20-audit-first-remediation.md` |
| M21 | CORS and browser cross-origin trust boundary | cors, origin, preflight, cross-origin, browser-security | M04, M05 | `modules/m21-cors-browser-boundary.md` |
| M22 | Agent execution contract and policy adherence | agent-policy, agent-instructions, gemini, claude, chatgpt, antigravity | M01 | `modules/m22-agent-execution-contract.md` |

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
- `saas-tenancy`: M03, M02
- `full-audit`: M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12, M13, M14, M15, M16, M17, M18, M19, M20, M21, M22

Dependencies are transitive and mandatory. A module may require other modules even when the task appears narrow. Full audit means all 22 modules and all 13 assurance layers.
