# USS severity classification rubric

**Status:** Supplemental decision aid for applying M17  
**Authority:** M17 and the Kernel remain controlling. This rubric clarifies evidence collection and consistent classification; it does not change the owner-approved P0/P1 release policy.  
**Reviewed:** 2026-11-18

## 1. Classify the deployed risk, not only the scanner label

Assign USS severity from the credible security outcome in the affected application and environment. Record:

- **Asset and boundary:** affected service, data, tenant, account, role, environment and trust boundary.
- **Attack path:** entry point, attacker prerequisites, required privileges, user interaction and network reachability.
- **Exploitability evidence:** reproducible proof, code path, configuration, exposure, mitigations and remaining uncertainty.
- **Impact:** confidentiality, integrity, availability, financial loss, tenant isolation, privilege escalation, safety and operational recovery.
- **Blast radius:** one object/user, one tenant, multiple tenants, the whole service or downstream systems.
- **Evidence confidence:** confirmed, strongly supported, plausible but unverified, or disproven by evidence.
- **Compensating controls:** independently verified controls that reduce likelihood or impact. Do not assume controls exist because documentation says they should.

A scanner finding, CVSS score, bug-bounty label or vendor severity is an input to triage, not the USS classification by itself.

## 2. USS severity rubric

| Severity | Decision standard | Typical examples | Release effect |
|---|---|---|---|
| **P0 - Critical** | A credible, reachable path enables catastrophic compromise or an immediate material breach of a critical trust boundary. | Unauthenticated remote code execution with broad impact; administrator/authentication bypass; cross-tenant access to highly sensitive data at scale; direct unauthorised financial manipulation; exposed active production root credentials; unauthenticated forged payment events that alter money or entitlements. | BLOCK. Non-waivable. |
| **P1 - High** | A realistic, reachable path creates major compromise, material data exposure/corruption, privilege escalation, financial loss, or serious service disruption. | Sensitive endpoint missing effective authorization; exploitable tenant-boundary defect; major payment idempotency or state-transition failure; serious session compromise; high-impact SSRF to internal control plane; critical reachable dependency flaw in a privileged production path. | BLOCK. Non-waivable. |
| **P2 - Medium** | A bounded weakness has meaningful but limited impact, requires constrained prerequisites, or is mitigated by independently verified controls without eliminating the risk. | Limited data exposure with narrow scope; missing rate limit on a non-critical endpoint; moderate dependency issue in a reachable but low-privilege component; incomplete monitoring with compensating detection. | WARN/remediate. Unresolved risk may be accepted only through the documented P2/P3 process. |
| **P3 - Low** | The issue has low practical impact or is primarily a hardening/documentation improvement with no demonstrated material exploit path. | Minor security-header gap on a non-sensitive route; low-impact information disclosure; documentation or maintainability weakness. | Informational or scheduled remediation. Risk acceptance only through the documented process. |

These examples are illustrative, not automatic mappings. A defect's actual impact, exposure, business context and evidence determine its classification.

## 3. Decision sequence

1. Confirm the affected asset, environment, endpoint and security boundary.
2. Identify a plausible attacker and required access, privileges, interaction and preconditions.
3. Trace the complete path from attacker-controlled input to the security-sensitive effect.
4. Reproduce the issue safely in an authorised test environment or obtain equivalent authoritative evidence.
5. Determine the final impact, including downstream systems, other tenants, money, sensitive data and recovery cost.
6. Evaluate mitigations only after verifying that they are active, effective and cannot be bypassed through another route.
7. Assign P0-P3 and record the rationale, confidence and evidence.
8. For CVSS, record the version, score and full vector string. State whether the score is Base, Base+Threat, Base+Environmental or Base+Threat+Environmental where applicable.
9. Reassess when new exploit evidence, exposure, threat intelligence, affected versions or deployment context becomes known.

## 4. Uncertainty and tie-breaking

- Unknown reachability is not proof of non-reachability. Keep the finding unresolved and investigate.
- Unknown exploitability is not a reason to downgrade. Record the uncertainty and use the highest credible severity supported by the available impact and attack-path evidence until the uncertainty is resolved.
- A control is a compensating mitigation only when its operation and scope are independently evidenced.
- Do not downgrade because remediation is inconvenient, expensive, disruptive or owned by another team.
- Do not assign P0/P1 solely because a vendor or scanner labels a finding Critical/High. Verify the affected version, reachable path and USS impact criteria.
- Do not downgrade a P0/P1 because a proof of concept is unavailable if the code path and impact are otherwise established.
- If the same root cause affects multiple endpoints or tenants, assess the aggregate blast radius, not only the first observed record.

## 5. Risk acceptance and release

- P0/P1 cannot be accepted, waived, relabelled or silently downgraded. Release remains blocked until remediation and evidence-based verification.
- P2/P3 risk acceptance must identify the owner, affected assets and scope, rationale, residual risk, verified compensating controls, approval date and expiry date.
- Acceptance must be time-bounded and reviewed when the system, threat or mitigation changes.
- A remediation marked complete is not VERIFIED until a retest or equivalent evidence demonstrates that the original attack path no longer works and no regression was introduced.
- A report may be structurally valid while the assessment remains NOT_READY. The evidence validator does not replace severity review or human release approval.

## 6. Suggested severity record

For each finding, retain:

- Finding ID and affected USS control-family ID.
- Severity and rationale.
- Asset, environment, route and affected tenant/data classes.
- Attack preconditions and reproducible steps or evidence reference.
- Impact and blast radius.
- Exploitability and confidence.
- CVSS version, score and vector where available.
- Verified mitigations and residual risk.
- Remediation owner, due date, retest evidence and final status.
- For P2/P3 acceptance: approver, rationale, compensating controls and expiry.

## Primary reference

- [FIRST: CVSS v4.0 Specification](https://www.first.org/cvss/v4.0/specification-document)

CVSS v4.0 separates Base, Threat, Environmental and Supplemental metric groups. USS severity must still be assigned using M17 and the actual application context; do not substitute the CVSS number for the USS release decision.
