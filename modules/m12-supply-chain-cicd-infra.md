# M12 CI/CD, infrastructure and software supply chain

**Source sections:** GLOBAL:8, GLOBAL:21  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**## 8. CI/CD Security Standard**



A secure engineering workflow should progress toward:



\`\`\`text

Developer / AI Agent

        ↓

Local validation

        ↓

Git push

        ↓

Pull Request

        ↓

CI

  - locked dependency install

  - type-check / compile

  - tests

  - secret scan

  - dependency audit

  - SAST

  - risk classification

  - AI review

  - security gate

        ↓

Human approval for high-risk changes

        ↓

Merge

        ↓

Immutable build artifact

        ↓

Staging deployment

        ↓

Smoke / integration / DAST checks

        ↓

Production approval

        ↓

Backup / migration gates

        ↓

Production deployment

        ↓

Health verification

        ↓

Rollback if postconditions fail

\`\`\`



**### CI Rules**



\- CI must fail closed when required validation is missing, skipped unexpectedly, malformed, or failed.

\- A PR must not be able to weaken the policy evaluating that same PR.

\- Security-sensitive workflow/configuration files require elevated review.

\- Build/review dependencies should be pinned to immutable versions/commit SHAs where possible.

\- Dependency installation must use lockfiles/frozen installs.



**### CD Rules**



\- Do not automatically deploy security-critical systems directly from an unreviewed branch.

\- Prefer **\*\*Continuous Delivery\*\*** with production approval before enabling fully automatic **\*\*Continuous Deployment\*\***.

\- Deploy the exact reviewed artifact/commit.

\- Separate staging and production environments/secrets.

\- Migrations require explicit forward/rollback strategy.

\- Production health checks must be machine-verifiable.

\- Failed post-deployment checks must stop rollout and trigger a defined rollback/incident path.

\- Prevent concurrent production deployments.

\- Preserve deployment provenance: actor, commit, artifact, environment, time, migration state, health result, and rollback result.



\---

**## 21. Dependency, Lockfile & Software Supply-Chain Maintenance Control**
