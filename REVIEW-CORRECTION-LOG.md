# Claude review correction log

**Review correction branch:** integration/uss-pr3-pr8-hardening  
**Status date:** 2026-11-20  
**Merge status:** Integration branch candidate. Nothing in this correction series has been merged into main.

This log tracks the findings as summarised during the Claude review discussion, updated with implementation and verification evidence across the unified candidate.

| Finding | Correction and evidence | Status |
|---|---|---|
| P1.1 - Missing concrete security controls | Added implementation supplements for OAuth/OIDC/JWT/MFA, SSRF, GraphQL/WebSocket/gRPC, cryptographic storage, data lifecycle/privacy and container/cloud runtime under `supplements/`. Implemented supplement routing in `manifest.json` and `tools/resolve-task.mjs`. | IMPLEMENTED AND VERIFIED. Automated resolution and disk path validation tested in `tests/task-resolver.test.mjs`. |
| P1.2 - Missing deterministic security enforcement | Added Gitleaks full-history scan, Semgrep (pinned by immutable SHA256 digest), CodeQL, OSV-Scanner, control catalog, evidence validator (`tools/validate-evidence.mjs`), AST workflow security mutation tests, and consumer workflow template. | IMPLEMENTED AND VERIFIED. Verified locally and via workflow security AST tests (119 unit tests passing on Node 20 runtime). OSV lockfile concern resolved with pinned `yaml@2.9.1` dependencies (0 vulnerabilities). |
| P1.3 - Weak default routing | Hardened resolver argument handling and prototype-property checks; expanded code-change baseline; added additive task-plus-keyword routing and regression tests; introduced `--strict` mode failing closed on unmatched keywords or empty selectors. | IMPLEMENTED AND VERIFIED. 22 tests passing in `tests/task-resolver.test.mjs`. |
| P1.4 - Circular trust root | Established owner SSH release-signing identity in `SECURITY-ROOT.md`, `SECURITY-ROOT.pub`, and `.security/allowed_signers` (`jude_m2003@yahoo.com`, fingerprint `SHA256:zfXCAflnGbD1984rV8kabaPj92UyXIs0gCVsIspIX/o`). Updated `CONSUMING.md` with 8-step trust-bootstrap verification. Hardened `tools/checksums.mjs` against index-flag and disk tampering. | IMPLEMENTED AND VERIFIED. 15 tests passing in `tests/checksums.test.mjs`, including 6 adversarial bypass tests. |
| P1.5 - Repository protection and licensing | Updated OWNER-ACTIONS.md and verified repository settings. Published PNCUL 1.0 licence in PR #4. Configured active GitHub ruleset `Protect Main` (ruleset ID `27612394`) requiring pull requests and review-thread resolution, and blocking force pushes and deletion. It does **not** require linear history, CODEOWNERS approval, or a minimum number of approving reviews (`required_approving_review_count: 0`). Renamed repository to `security-governance-framework`. | IMPLEMENTED AND VERIFIED. Verified against active GitHub repository settings. |
| P2.6 - Weak M11 AI security | Added concrete agent/tool execution, approval binding, RAG isolation, memory, output validation, provider governance and adversarial test guidance in `supplements/ai-agent-security.md`. | IMPLEMENTED AND VERIFIED. M11 canonical directives preserved; supplement integrated into resolver. |
| P2.7 - Ambiguous severity classification | Added `assurance/severity-classification.md` with impact, reachability, blast-radius, uncertainty and CVSS v4.0 mapping, strictly preserving non-waivable P0/P1 release policy. | IMPLEMENTED AND VERIFIED. Verified by `tests/documentation.test.mjs` and `tools/validate.mjs`. |
| P2.8 - Control IDs not implemented | Derived content-addressed statement IDs (`USS-XXX.<8 hex>`, over 500 statements across 22 modules with uniqueness and change detection tested in `tests/requirement-ids.test.mjs`). Mapped module families in `assurance/control-catalog.json`. | IMPLEMENTED AND VERIFIED. 4 regression tests passing. Stable requirement IDs generated deterministically. |
| P2.9 - Weak validator | Implemented `tools/validate-evidence.mjs` with strict evidence/finding linkage, non-waivable P0/P1 release blocks, time-bounded P2/P3 risk acceptance with mandatory owner rationale, catalog validation, and CLI tests. | IMPLEMENTED AND VERIFIED. 19 tests passing in `tests/evidence.test.mjs`. |
| P2.10 - M09 and stack profiles incomplete | Added data lifecycle/privacy supplement and reference technology checklists for Node.js/Express, Python/FastAPI, Laravel/PHP, React/TypeScript, and Flutter/Dart under `stacks/`. | IMPLEMENTED AND VERIFIED. All 5 stack profiles explicitly marked and verified as `REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION`. |
| P3.11 - Repository bloat | Reassessed module sizes against 100 KB routine task budget. No security controls were removed to maintain complete source traceability. All routine tasks measure well within budget (e.g., `code-change` 12.2 KB, `authentication` 31.8 KB, `payments` 94.3 KB). Audit tasks (`full-audit` 149.7 KB) intentionally cover the full assurance surface. | IMPLEMENTED AND VERIFIED. Verified by `tools/validate.mjs`. |
| P3.12 - Broken Markdown | Performed link validation and syntax verification across README, supplements, stack profiles, and modules. | IMPLEMENTED AND VERIFIED. Verified by `tests/documentation.test.mjs` and `tests/markdown-rendering.test.mjs`. |
| P3.13 - Resolver prototype bug | Task lookup uses own-property checks; inherited object property names (constructor, toString, __proto__) fail closed with exit code 2. | IMPLEMENTED AND VERIFIED. Regression tests in `tests/task-resolver.test.mjs`. |
| P3.14 - Tests depend on build order | Unit tests no longer require untracked `dist/bundles` output. Build scripts generate deterministic artifacts verified with 0 drift. | IMPLEMENTED AND VERIFIED. Verified via clean test execution. |
| P3.15 - Naming and consistency | Standardized repository name to `security-governance-framework` across all documentation, tools, indexes, and release checklists. | IMPLEMENTED AND VERIFIED. |

## Claude Independent Audit Remediation (v1.0.0-rc.1)

| Finding ID | Claude Audit Finding | Correction and Evidence | Status |
|---|---|---|---|
| **U-01** | Release signing ceremony | Owner retains private SSH signing key on workstation. Candidate prepared for owner signing; no agent impersonation or unauthorized release tagging performed. | OWNER CEREMONY PENDING. |
| **U-02** | Evidence validator accepts PASS with failed result | Hardened `tools/validate-evidence.mjs` with closed allowlists (`SUCCESS_RESULTS` vs `FAILURE_RESULTS`), structural rejection of PASS controls backed by failed results, rejection of placeholder references (`n/a`, `none`, `unknown`, `tbd`, `-`), rejection of future assessment and evidence dates, and temporal consistency checks. Verified with 26 passing tests in `tests/evidence.test.mjs`. | REMEDIATED AND VERIFIED. |
| **U-03** | Workflow security mutation resilience | Added `timeout-minutes: 15` across runner jobs in `.github/workflows/security-scans.yml`. Added structural AST checks and 5 negative mutation tests in `tests/workflow-security.test.mjs` rejecting direct `github.event` shell interpolation, unapproved `workflow_run` triggers, `npm install`, removal of `--ignore-scripts`, and missing timeouts. Verified with 20 passing tests. | REMEDIATED AND VERIFIED. |
| **U-04** | Checksum tooling nested `.git` and root hooks bypass | Hardened `tools/checksums.mjs`: detects and rejects nested `.git` directories in Git mode, rejects active root `.git/hooks` in filesystem mode, and prohibits any `.git` segment in release paths. Added 3 regression tests in `tests/checksums.test.mjs` (17 tests passing). | REMEDIATED AND VERIFIED. |
| **U-05** | Security scanner scope and commit provenance | Updated Gitleaks job name to reflect commit range scan on push/PR and full history on schedule. Expanded Semgrep scan target to `tools/ tests/`. Verified official provenance of OSV commit pin `d3c1414ded37de590f207572e37a7d180f1d0ef7` on `google/osv-scanner-action` and documented in `SECURITY-ROOT.md`. | REMEDIATED AND VERIFIED. |
| **U-06** | Clean checkout dependency documentation | Documented `npm ci --ignore-scripts` requirement across `README.md`, `CONSUMING.md`, `RELEASE-CHECKLIST.md`, and `CONTRIBUTING.md`. Clarified that core tools require zero dependencies and explained the supply-chain security mandate for `--ignore-scripts`. | REMEDIATED AND VERIFIED. |
| **U-07** | Module traceability and original work preservation | Labeled supplemental sections in `tools/build-modules.mjs` (M06, M12, M21) with `## USS implementation guidance: ...` and explanatory blockquotes. Corrected M06 webhook timestamp requirement to specify provider-signed timestamps where supplied without incorrectly mandating a separate header from all providers. Added W3C Private Network Access (PNA) guidance to M21. Regenerated all modules with 0 drift. | REMEDIATED AND VERIFIED. |
| **U-08** | Main branch protection ruleset verification | Inspected existing GitHub ruleset `Protect Main` (ruleset ID `27612394`). Mandatory second-person review remains disabled per owner decision. Documented that adding `USS validation` as a required status check requires owner approval after hosted CI is confirmed. Main remained unmodified. | DOCUMENTED FOR OWNER ACTION. |
| **U-09** | Version alignment across codebase | Set candidate version to `1.0.0-rc.1` across `VERSION`, `package.json`, `manifest.json`, `templates/security-evidence.example.json`, `KERNEL.md`, `README.md`, `RELEASE-CHECKLIST.md`, and `CHANGELOG.md`. Explained that final `v1.0.0` will be created only during owner signing ceremony. | REMEDIATED AND VERIFIED. |
| **U-10** | Resolver CLI failure mode, stack profiles and licensing | Updated `tools/resolve-task.mjs` to exit with status code 2 when invoked without arguments. Added stack profile routing (`--stack <name>`). Created reference profiles for Go (`stacks/go.md`), Rust (`stacks/rust.md`), and Java/Spring Boot (`stacks/java-spring.md`), marked REFERENCE ONLY. Added `"stacks"` to `manifest.json`. Added license and author fields to `package.json`. Created `THIRD-PARTY-NOTICES.md` documenting `yaml@2.9.1`. Added `namespaces="git,USS-SHA256SUMS"` to `.security/allowed_signers` and expanded `.github/CODEOWNERS` for complete repository coverage. | REMEDIATED AND VERIFIED. |

## Supervisory Review Remediation (SUP-01 through SUP-06)

| Finding ID | Supervisory Finding | Correction and Evidence | Status |
|---|---|---|---|
| **SUP-01 / U-01** | Release signing blocker identity | Preserved original U-01 identity in PR description and documentation. Release manifest and tag signing remains exclusively the owner's responsibility on his personal workstation. | PRESERVED FOR OWNER. |
| **SUP-02 / U-08** | Main ruleset required status checks and ID | Corrected ruleset ID (`27612394`) and parameters. Preserved single-owner non-blocking model; documented option of requiring `USS validation` as a status check for owner decision. | DOCUMENTED FOR OWNER DECISION. |
| **SUP-03 / U-05** | Semgrep scan coverage & skipped files | Investigated the 9 skipped files: identified that Semgrep's default built-in ignore patterns automatically skipped all 9 files in `tests/`. Created repository-root `.semgrepignore` (`node_modules/`, `.git/`) and added `--verbose` to CI workflow. Verified Semgrep scans all 18 files (9 tools, 9 tests) with 0 skipped and 0 findings. | REMEDIATED AND VERIFIED. |
| **SUP-04 / U-06/U-09** | Test-only dependency classification and lockfile version sync | Moved `yaml@2.9.1` from `dependencies` to `devDependencies` in `package.json`. Regenerated `package-lock.json`, aligning root package version to `1.0.0-rc.1`. Verified `npm ci --ignore-scripts` and full test suite (136/136 tests pass). | REMEDIATED AND VERIFIED. |
| **SUP-05** | Stale coordination ledger timestamp and actions | Updated `coordination/agent-handoff.md` timestamp, verified branch head, and recorded engineering responses to supervisory review. | REMEDIATED AND VERIFIED. |
| **SUP-06** | Overstated active ruleset in OWNER-ACTIONS.md | Corrected `OWNER-ACTIONS.md` Section 1 and Section 7. Removed inaccurate claims regarding linear history and CODEOWNERS enforcement; accurately described active ruleset `Protect Main` (ID `27612394`). | REMEDIATED AND VERIFIED. |

## Verification summary

The implementation candidate contains remediation changes for the listed technical findings and the latest hosted CI run passed, including 136 automated tests, Semgrep coverage of 18/18 intended files, and successful Gitleaks, CodeQL, and OSV checks. These results are implementation and CI evidence, not a substitute for Claude's pending second independent audit. Owner-dependent items remain U-01 (final release signing ceremony) and U-08 (whether to require the USS validation status check), as documented in OWNER-ACTIONS.md.


## Claude Second Independent Audit — 2026-11-20

**Audited HEAD:** `7e12fe60498551bd29807c37efe70966cc6b3b92`  
**Verdict:** NOT APPROVED FOR RELEASE. The candidate passed its configured hosted CI, but Claude independently reproduced additional workflow and filesystem-checksum bypasses.

| Finding | Independent supervisory cross-check | Current disposition |
|---|---|---|
| A2-02 — Workflow mutation guard gaps | Confirmed by direct inspection of `tests/workflow-security.test.mjs`: absent permissions, job permissions, trigger allow-list, expression variants and required gate conditions are not fully enforced. | OPEN, P2 |
| A2-03 — Root .git filesystem checksum bypass | Confirmed by direct inspection of `tools/checksums.mjs`; filesystem mode ignores root `.git` metadata after checking only active hooks. Claude supplied the reproduced `core.fsmonitor` execution test. | OPEN, P2 |
| A2-04 — README release claims | Confirmed: PR #9 is open against the integration branch, not merged to main; badge branch is stale; README omitted six of eight stack profiles. README corrected in the owner-issued supervisory follow-up commit, pending Gemini verification. | FIXED_UNVERIFIED, P2 |
| A2-05 — Live ruleset evidence | Independently queried authenticated GitHub API. Ruleset `Protect Main` ID `27612394` is active with PR, thread-resolution, deletion and non-fast-forward rules; zero approvals, no CODEOWNERS requirement and no required status checks. Matches owner decision. | VERIFIED |
| A2-06 — Evidence validator residuals | Source inspection confirms short placeholder deny-list and 7-64 character commit validation; independent approval and maximum acceptance duration need policy-aligned hardening. | OPEN, P3 |
| A2-07 — Scanner scope and provenance | Confirmed Semgrep targets only `tools/` and `tests/`; CodeQL is configured for JavaScript/TypeScript; OSV uses an immutable commit pin whose upstream provenance needs recorded verification. | OPEN, P3 |
| A2-08 — Agent commit provenance | GitHub reports the recent remediation commits as unsigned and authored as the owner. Repository access check shows the owner has write permission and `jayblisstech-bot` has pull-only permission. | OPEN, P3, owner access decision |
| A2-09 — Checksum exclusions | Remaining documented threat-model limitations for excluded directories, empty directories and executable bits. | OPEN, P3 |
| A2-10 — Read-only audit role clarity | Explicit read-only audit and commit-provenance boundaries added to `automation.md` in the owner-issued supervisory follow-up commit. | FIXED_UNVERIFIED, P3 |
| A2-11 — Stack profile completeness | Eight profiles exist, but earlier content gaps were not re-audited in this pass. | UNKNOWN, P3 |
| A2-12 — PNA terminology | Needs current primary-source review. | UNKNOWN, P3 |
| U-01 / SUP-01 — Release signing | No signed `SHA256SUMS`, detached signature or final signed `v1.0.0` tag exists. Owner-only action after technical closure. | OPEN, P1 |

### Live repository evidence

- PR #9 is still open, unmerged and mergeable; head is the audited SHA and base is `integration/uss-pr3-pr8-hardening`.
- Seven configured checks at the audited SHA completed successfully.
- `main` remains at `a616ade2963bc69dd2140a65016d0756c13399d8`.
- Authenticated ruleset API response for ID `27612394` confirms the exact active rules listed above.

Passing CI is not a substitute for the missing adversarial controls. Do not sign or release until P2 findings are fixed and independently re-audited.
