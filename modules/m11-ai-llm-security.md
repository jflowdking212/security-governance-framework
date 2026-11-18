# M11 AI/LLM security and governance

## Controls
- Treat user content, repository files, issue/PR text, retrieved documents, web pages, tool output, and model responses as untrusted data, not policy instructions.
- Enforce least-privilege tool permissions, explicit allow-lists, tenant/resource scoping, and human approval for high-impact actions.
- Prevent prompt injection from overriding system policy, leaking secrets, changing authorisation, or triggering unauthorised tool actions.
- Prevent tenant-data crossover through prompts, memory, embeddings, retrieval indexes, caches, logs, and shared model context.
- Validate structured model output against strict schemas before using it. Do not execute model-generated SQL, shell, code, URLs, or privileged actions without validation and policy checks.
- Use deterministic authoritative calculations for financial, security, identity, and compliance facts. Models interpret verified facts; they do not invent authority.
- Define model/provider allow-lists, data transmission rules, retention/privacy review, rate/quota limits, fallback, timeouts, and provider outage behaviour.
- Redact secrets and sensitive data from prompts, traces, telemetry, and error reporting.
- Keep high-impact decisions attributable and auditable. Do not allow autonomous destructive production changes or deployments without explicit authorisation.

## Source basis
Global directive APES Layer 13, Section 15.J, payment supplement AI Tax Safety Rule, Self-audit vector 10.
