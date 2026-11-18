# M12 CI/CD, infrastructure and software supply chain

**Source sections:** GLOBAL:8, GLOBAL:21, GLOBAL:3:Layer7, GLOBAL:3:Layer8, GLOBAL:3:Layer9  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**## 8. CI/CD Security Standard**



A secure engineering workflow should progress toward:



```text

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

```



**### CI Rules**



- CI must fail closed when required validation is missing, skipped unexpectedly, malformed, or failed.

- A PR must not be able to weaken the policy evaluating that same PR.

- Security-sensitive workflow/configuration files require elevated review.

- Build/review dependencies should be pinned to immutable versions/commit SHAs where possible.

- Dependency installation must use lockfiles/frozen installs.



**### CD Rules**



- Do not automatically deploy security-critical systems directly from an unreviewed branch.

- Prefer **Continuous Delivery** with production approval before enabling fully automatic **Continuous Deployment**.

- Deploy the exact reviewed artifact/commit.

- Separate staging and production environments/secrets.

- Migrations require explicit forward/rollback strategy.

- Production health checks must be machine-verifiable.

- Failed post-deployment checks must stop rollout and trigger a defined rollback/incident path.

- Prevent concurrent production deployments.

- Preserve deployment provenance: actor, commit, artifact, environment, time, migration state, health result, and rollback result.



---

**## 21. Dependency, Lockfile & Software Supply-Chain Maintenance Control**



Third-party and transitive dependencies are part of the application's effective codebase and attack surface even when developers did not install them directly.

A dependency tree that currently builds successfully is not evidence that it is secure, reproducible, maintained, or safe to deploy.



### 21.1 Direct and Transitive Dependency Ownership



- **Transitive Dependencies Count:** Treat dependencies pulled in indirectly by frameworks, SDKs, plugins, build tools, package managers, and other libraries as part of the application's supply-chain risk.

- **Inventory the Actual Tree:** Security review MUST consider the resolved dependency tree, not only the small set of packages explicitly listed by developers.

- **No "We Didn't Install It" Exception:** A vulnerable transitive package remains relevant when it is included in the deployed/runtime/build artifact or affects the software supply chain.

- **Runtime vs. Build/Development Context:** Distinguish runtime, production, development, build, test, and tooling dependencies when assessing impact. Do not automatically dismiss development/build dependencies if they can execute in CI, access secrets, alter build output, or compromise release artifacts.



### 21.2 Lockfile Discipline



- **Commit the Canonical Lockfile:** For application repositories using an ecosystem that supports lockfiles, commit the package manager's canonical lockfile unless there is a documented architecture-specific reason not to.

- **Do Not Delete Lockfiles to "Fix" Dependency Problems:** Do not routinely delete/regenerate a lockfile merely to clear install errors or vulnerability reports. Understand and review the resulting dependency changes.

- **Deterministic/Frozen Installs:** CI, release, and production builds SHOULD use the package manager's deterministic/frozen install mode where available so the build fails when manifest and lockfile state are inconsistent rather than silently resolving an unexpected dependency tree.

Examples include ecosystem-appropriate commands/modes such as `npm ci`, frozen/immutable lockfile installs, or equivalent package-manager functionality.

- **Lockfile Review:** Treat meaningful lockfile changes as code/supply-chain changes. Review unexpectedly large dependency-tree changes, new registries/sources, git/tarball dependencies, lifecycle scripts, and newly introduced packages.

- **One Authoritative Package Manager Per Workspace Where Practical:** Avoid conflicting lockfiles from multiple package managers unless the repository intentionally contains independently managed workspaces. Do not allow CI and local/production builds to resolve through different accidental package-manager states.

- **Lockfile Is Reproducibility, Not Security Proof:** A committed lockfile helps reproduce a known dependency tree; it does NOT prove the locked versions are vulnerability-free, authentic, maintained, or safe.



### 21.3 Vulnerability Scanning



- **Use Ecosystem-Appropriate Scanning:** Run the package manager or SCA scanner appropriate to the technology in use. Examples may include `npm audit`, `composer audit`, `pip-audit`, `cargo audit`, OSV/SCA tooling, or equivalent mechanisms.

- **Do Not Apply an npm-Only Rule Globally:** `npm audit` applies to npm dependency trees. Non-Node repositories require their ecosystem-appropriate audit/scanning mechanism.

- **CI/PR/Release Integration:** Dependency vulnerability scanning SHOULD run automatically in CI or an equivalent gated workflow for security-sensitive repositories and before production releases. A monthly manual audit is a useful fallback/maintenance cadence, not a substitute for automated checks.

- **Continuous Advisory Monitoring:** Where supported, enable dependency/advisory monitoring or update tooling so newly disclosed vulnerabilities can be surfaced after code has already been deployed.

- **SBOM/SCA Alignment:** For serious production/enterprise systems, maintain or generate an SBOM/dependency inventory where practical and align vulnerability findings to the actual deployed version/artifact.

- **Audit Tool Limitations:** A clean package-manager audit means no matching known advisories were reported under that tool's data and configuration at that time. It does NOT prove the dependency tree contains no vulnerabilities, malicious packages, compromised maintainers, unsafe install scripts, unmaintained libraries, or unknown/zero-day defects.



### 21.4 Finding Triage and Applicability



- **Do Not Count Only Severity:** Record severity, affected versions, dependency path, runtime/build reachability, exposure, exploit prerequisites, available remediation, and whether the vulnerable component/functionality is actually present in the deployed context.

- **Do Not Ignore High/Critical Findings Because They Are Transitive:** Trace which direct dependency introduces the vulnerable package and determine the correct upgrade/replacement/override path.

- **Do Not Blindly Block on Irrelevant Noise:** When an advisory is demonstrably not applicable to the deployed context, document evidence and residual risk rather than repeatedly suppressing it without explanation.

- **Known Exploited / High-Impact Issues:** Give elevated priority to reachable vulnerabilities with known exploitation, remote compromise potential, authentication/authorization bypass, data exposure, build-pipeline compromise, or other material impact.

- **Abandoned/Unmaintained Dependencies:** A dependency with no viable security maintenance path may require replacement even when no current advisory exists. Track maintenance health for high-impact packages.



### 21.5 Safe Remediation



- **Prefer Minimal Compatible Remediation:** Upgrade to the smallest safe supported version that resolves the issue when practical, then run the full relevant verification suite.

- **Do Not Blindly Run Force-Upgrades:** Commands that permit major-version or otherwise breaking dependency changes, including force-style audit remediation, MUST NOT be applied automatically to production-sensitive repositories without reviewing the proposed dependency delta and compatibility impact.

- **Automated Fixes Still Require Verification:** `audit fix`, dependency bots, automated pull requests, overrides/resolutions, or equivalent tooling may propose or apply updates, but the resulting build, tests, security checks, migrations, integrations, and runtime behavior must still be verified.

- **Overrides/Resolutions Are Controlled Exceptions:** Package overrides/resolutions may be used to force a safe transitive version only when compatibility is understood and verified. Do not silently pin an incompatible transitive dependency.

- **Replacement May Be Safer Than Patching:** When a direct dependency is abandoned, repeatedly vulnerable, or prevents remediation of critical transitive issues, evaluate removal or replacement rather than indefinitely stacking exceptions.

- **No Unreviewed Production Updates:** Do not automatically deploy dependency updates directly to production merely because an audit tool or bot generated them. Follow the directive's CI/CD, review, staging, approval, and rollback controls.



### 21.6 Dependency Update Cadence



- **Maintenance Is Recurring:** Dependency security is an ongoing lifecycle, not a one-time pre-launch task.

- **Cadence Based on Risk:** Establish a recurring review cadence appropriate to the system's exposure and criticality. Monthly review may be reasonable for ordinary maintenance, but high-risk production systems SHOULD also rely on automated advisory monitoring/CI rather than waiting for the next calendar review.

- **Emergency Updates:** A known actively exploited or materially reachable Critical/High vulnerability may require out-of-cycle remediation. Do not wait for a scheduled maintenance date.

- **Update in Managed Batches:** Avoid allowing dependencies to remain untouched for so long that upgrades become a large, untestable jump. Prefer regular, reviewable update batches with regression testing.



### 21.7 Registry, Source & Install-Script Controls



- **Approved Sources:** Review dependency registry/source configuration. Avoid unknown registries, unreviewed git URLs, remote tarballs, or package sources that bypass normal integrity/provenance controls without a documented reason.

- **Lifecycle Scripts Are Code Execution:** Treat package install/postinstall/build scripts as executable code with supply-chain implications, particularly in CI systems that possess secrets or deployment credentials.

- **Typosquatting/Confusion Review:** For newly introduced dependencies, verify package identity, publisher/source, expected repository, and naming. Be alert for typosquatting, dependency-confusion, and similarly named malicious packages.

- **Integrity/Provenance Where Available:** Use package-manager integrity verification, registry signatures/provenance, pinned sources, or equivalent ecosystem controls where supported and operationally appropriate.

- **Least-Privilege CI:** Dependency installation/build jobs should not automatically receive powerful production secrets or deployment permissions they do not require.



### 21.8 Mandatory Dependency Verification



For applicable repositories verify:

- canonical manifest and lockfile are present and committed where the ecosystem expects them;

- CI/release uses deterministic/frozen installation where available;

- dependency/security audit command executes successfully and exit code/result is recorded;

- unresolved Critical/High findings are reviewed for reachability/applicability and either remediated, mitigated, or explicitly risk-accepted according to the directive;

> **OWNER POLICY OVERRIDE (OWNER:RELEASE-POLICY):** This risk-acceptance pathway applies only to P2/P3 findings. It must never be used to approve, waive, downgrade, relabel, or release with an open P0/P1 finding. Any P0/P1 finding remains a hard production-release blocker until remediated and verified.

- direct and transitive dependency paths for material findings are understood;

- no unreviewed `--force`/major-version remediation is applied;

- dependency update results pass relevant tests, typecheck/build/lint, integrations, and security checks;

- newly introduced dependency sources/packages are reviewed;

- lower-environment/CI install scripts cannot unnecessarily access production secrets;

- advisory monitoring or an appropriate recurring review cadence exists;

- known active-exploitation findings are not deferred merely until the next scheduled audit;

- dependency exceptions/suppressions/overrides have documented rationale and review conditions.



### 21.9 Dependency Supply-Chain Release Gate



Do NOT mark a repository's dependency posture **secure** merely because:

- `npm audit` or another single scanner reports zero findings;

- a lockfile exists;

- dependencies install successfully;

- a dependency bot opened no pull requests;

- only direct dependencies were manually reviewed.

Before production approval, verify as applicable:

- the resolved direct and transitive dependency tree is reproducible;

- lockfile/manifest state is consistent;

- appropriate vulnerability/SCA scanning has run;

- material findings have been triaged by applicability and risk;

- unresolved Critical/High risks are not silently accepted;

- remediation changes have been tested;

- build/install scripts and dependency sources have been considered;

- CI/release dependency installation follows deterministic and least-privilege practices;

- ongoing monitoring/maintenance is defined.

A lockfile freezes a dependency decision. It does not prove that decision is safe forever.

**### Layer 7 — Dependencies & Software Supply Chain**



Review lockfiles, deterministic installs, dependency vulnerabilities, malicious/abandoned packages, transitive risk, SBOM availability, secret scanning, SAST/static scanning, package scripts, CI action pinning, artifact provenance, generated binary artifacts, and source-control history for leaked credentials.

**### Layer 8 — Infrastructure, Hosting & Network Security**



Review or verify production topology, exposed services/ports, firewall/security groups, reverse proxy configuration, TLS termination, database network exposure, SSH/admin access, host/container hardening, least-privilege service accounts, filesystem permissions, object storage ACLs, secrets injection/retrieval, explicit dev/test/staging/production resource separation, database/account separation, lower-environment access to production, production-data use in non-production, secret-manager/startup outage behavior where applicable, credential scope, and patch/update process.



Do not infer infrastructure controls from application code alone.

**### Layer 9 — CI/CD & Release Security**



Review protected branches, mandatory status checks, immutable/pinned workflow dependencies, build/test gates, deployment approvals, environment-scoped secrets, prevention of secret exposure in CI logs/artifacts, prevention of lower-environment jobs/tests/seeders from targeting production, credential rotation/deployment implications, immutable artifact promotion, migration gates, staging validation, production health checks, deployment concurrency locking, rollback, exact commit/release traceability, and prohibition of fail-open deployment.



A successful `git push` only proves the remote received the commit. It does NOT prove CI, security review, deployment, or production health succeeded.
