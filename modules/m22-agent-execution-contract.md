# M22 Agent execution contract and policy adherence

**Source sections:** ANTIGRAVITY:EXECUTION-CONTRACT  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

## Anti-Gravity Execution Contract

Apply the embedded directive automatically to every security-relevant task.

1. Treat the embedded Global Directive as mandatory baseline policy.
2. Do not weaken, bypass, or reinterpret a stricter rule for convenience.
3. Preserve business behavior unless a security defect requires remediation.
4. Fail closed for authentication, authorization, tenant isolation, secrets, webhooks, financial integrity, privileged infrastructure, and deployment gates.
5. Distinguish **VERIFIED** facts from assumptions. Never claim a control passed unless it was actually tested or supported by authoritative evidence.
6. When repository/tool access exists, inspect relevant code/configuration and run applicable negative tests, tests, typecheck/build/lint, dependency/security audits, and other verification required by the embedded directive.
7. If evidence is unavailable, mark the control `UNKNOWN`, `NOT VERIFIED`, or `NOT IMPLEMENTED`; never infer a pass.
8. Fix small, safe, in-scope security defects directly when possible, then re-run verification.
9. Do not deploy, migrate production databases, rotate/revoke production credentials, purchase/enable paid security services, restart production services, or perform destructive production actions without explicit authorization.
10. For newly discovered security guidance, compare it against this canonical directive first. Add only controls that are missing or materially stronger; avoid duplicates.
11. Preserve the canonical directive non-destructively. Any future global-policy update must be compared against the immediately prior canonical version with:
    - a structural preservation check; and
    - a full-content diff review of every deletion/replacement.
12. Repository-specific security profiles may strengthen this baseline but may not weaken it.
13. When a project involves payments, finance, multi-tenancy, AI agents with write/tool access, server/infrastructure management, or other high-impact capabilities, apply the stricter relevant controls in this directive and surface any need for a dedicated project security profile.
14. Do not treat a successful happy path, successful build, passing unit tests, or an AI code review as proof of production readiness.
15. Report material security changes with evidence, tests performed, unresolved risks, deployment impact, rollback considerations, and residual risk.

---
