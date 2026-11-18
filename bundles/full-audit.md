# USS full-audit task index

**Version:** 1.0.0  
**Purpose:** This file is a compact routing index, not a substitute for the modules listed below.

Read `KERNEL.md` first. Then read every module below in the listed dependency order. Do not load unrelated modules. For a task crossing another security boundary, resolve the additional task/module and its dependencies.

## Required module order

| Order | Module | Source sections | File |
|---:|---|---|---|
| 1 | M01 Core operating policy and secure engineering | GLOBAL:Core; GLOBAL:13; GLOBAL:14 | `modules/m01-engineering-workflow.md` |
| 2 | M08 Secrets, credentials and lifecycle management | GLOBAL:1.F; GLOBAL:17 | `modules/m08-secrets.md` |
| 3 | M02 Authentication, identity and sessions | GLOBAL:1.B authentication | `modules/m02-authentication-sessions.md` |
| 4 | M03 Authorisation, roles and tenant isolation | GLOBAL:1.B authorisation | `modules/m03-authorization-tenancy.md` |
| 5 | M04 Injection, input validation and client security | GLOBAL:1.A; GLOBAL:1.C | `modules/m04-input-injection-web.md` |
| 6 | M05 Network, transport and API hygiene | GLOBAL:1.D | `modules/m05-api-network-transport.md` |
| 7 | M09 Data protection, privacy and residency | GLOBAL:3:Layer4 | `modules/m09-data-protection.md` |
| 8 | M10 Operations, environment isolation, audit and incident response | GLOBAL:1.G; GLOBAL:11; GLOBAL:18 | `modules/m10-operations-audit-ir.md` |
| 9 | M06 Payments, webhooks and external event integrity | GLOBAL:1.E; PAYMENT:A1-A16; PAYMENT:WEBHOOK-NEGATIVE-TESTS | `modules/m06-payments-webhooks.md` |
| 10 | M07 Revenue tax and indirect-tax compliance | GLOBAL:15; PAYMENT:B1-B12; PAYMENT:AI-TAX-SAFETY; PAYMENT:TAX-VERIFICATION | `modules/m07-tax-compliance.md` |
| 11 | M11 AI/LLM security and governance | GLOBAL:3:Layer13; PAYMENT:AI-TAX-SAFETY | `modules/m11-ai-llm-security.md` |
| 12 | M12 CI/CD, infrastructure and software supply chain | GLOBAL:8; GLOBAL:21 | `modules/m12-supply-chain-cicd-infra.md` |
| 13 | M13 Mandatory in-line penetration self-audit | GLOBAL:2 | `modules/m13-self-audit.md` |
| 14 | M14 13-layer production security assurance model | GLOBAL:3 | `modules/m14-assurance-model.md` |
| 15 | M15 Production evidence, assurance pack and reporting | GLOBAL:4; GLOBAL:9; GLOBAL:12 | `modules/m15-evidence-reporting.md` |
| 16 | M17 Security finding severity and release gates | GLOBAL:7; OWNER:RELEASE-POLICY | `modules/m17-severity-release-gates.md` |
| 17 | M16 Audit, remediation and authorised penetration testing | GLOBAL:5; GLOBAL:6 | `modules/m16-audit-penetration-testing.md` |
| 18 | M18 Public security communication | GLOBAL:10 | `modules/m18-public-security-communication.md` |
| 19 | M19 Financial integration and revenue compliance release gate | GLOBAL:16; PAYMENT:GLOBAL-FINANCIAL-RELEASE-GATE | `modules/m19-financial-release-gate.md` |
| 20 | M20 Audit-first, risk-prioritised engineering and remediation | GLOBAL:19; OWNER:RELEASE-POLICY | `modules/m20-audit-first-remediation.md` |
| 21 | M21 CORS and browser cross-origin trust boundary | GLOBAL:20 | `modules/m21-cors-browser-boundary.md` |
| 22 | M22 Agent execution contract and policy adherence | ANTIGRAVITY:EXECUTION-CONTRACT | `modules/m22-agent-execution-contract.md` |

**Direct task modules:** M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12, M13, M14, M15, M16, M17, M18, M19, M20, M21, M22  
**Resolved modules including dependencies:** M01, M08, M02, M03, M04, M05, M09, M10, M06, M07, M11, M12, M13, M14, M15, M17, M16, M18, M19, M20, M21, M22

To compile the full text bundle locally, run:

```sh
node tools/build-bundles.mjs --task full-audit
```

Generated output is written to `dist/bundles/full-audit.md`.
