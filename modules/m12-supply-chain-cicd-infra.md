# M12 Dependencies, supply chain, infrastructure and CI/CD

## Dependency controls
- Maintain direct/transitive dependency inventory and lockfiles. Use deterministic, least-privilege installs and trusted registries.
- Run dependency/SCA and secret scanning. Triage findings for reachability, exploitability, exposure, and impact; do not ignore critical reachable vulnerabilities.
- Review abandoned/malicious packages, install scripts, package source, transitive changes, CI actions, generated binaries, and artifact provenance.
- Pin workflow actions/dependencies to immutable versions or SHAs where practical. Review updates and lockfile changes.

## Infrastructure controls
- Verify production topology, exposed ports, firewalls/security groups, TLS termination, database exposure, SSH/admin access, host/container hardening, service accounts, filesystem permissions, storage ACLs, and secrets injection.
- Separate dev/test/staging/production databases, credentials, queues, storage, payment events, seeders, migrations, and customer data. Do not infer infrastructure controls from application code.
- Use least privilege and a documented patch/update process. Verify hosting region and provider configuration from authoritative evidence.

## CI/CD and release controls
- Require locked installs, lint, typecheck/compile, tests, security scans, secret scans, and relevant negative tests before release.
- Protect branches, require status checks and review where available, scope CI secrets to environments, and prevent secrets leaking through logs/artifacts.
- Prevent lower-environment jobs/tests/seeders from targeting production. Use deployment approvals, migration gates, concurrency locks, health checks, rollback, immutable artifact promotion, and commit/release traceability.
- Never use fail-open release gates. A successful push is not proof CI passed or production is healthy.
- Record exact commands, results, exit codes, unresolved findings, and deployment evidence.

## Source basis
Global directive Sections 8, 21; APES Layers 7-9; Self-audit vectors 6, 13, 15.
