# Authorised security testing

- Test only systems, accounts, environments, and infrastructure the owner owns or explicitly authorises.
- Define written scope, test window, allowed techniques, rate limits, data-handling rules, contacts, stop conditions, and production restrictions.
- Prefer isolated staging/sandbox systems and synthetic data.
- Do not perform destructive, persistence, exfiltration, denial-of-service, credential-stuffing, or third-party testing unless explicitly authorised and safely bounded.
- Distinguish code review, automated scanning, internal adversarial testing, and independent external penetration testing. Never label one as another.
- Record tool/version, target, time, commands or test cases, evidence, impact, reproduction, severity, limitations, and retest result.
- Stop and notify the owner if testing reveals active compromise, sensitive-data exposure, instability, or out-of-scope assets.
