# M11 AI/LLM security and governance

**Source sections:** GLOBAL:3:Layer13, PAYMENT:AI-TAX-SAFETY  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**### Layer 13 — AI/LLM Security & Governance**



For AI-enabled systems or AI-assisted engineering workflows, review prompt injection, untrusted repository/document/user content, tool permission boundaries, provider/model allow-lists, secret leakage, sensitive-data transmission, tenant-data crossover through prompts/embeddings/caches/retrieval, hallucination controls, deterministic calculations for financial/security-critical facts, structured output validation, provider failure/fallback, model escalation, rate/quota exhaustion, logging/redaction, human approval for high-impact actions, autonomous deployment/destructive actions, and auditability of AI decisions.



For financial or security-sensitive systems, AI MUST interpret verified facts rather than invent authoritative values.



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
