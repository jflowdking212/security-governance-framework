# Owner actions required before USS v1.0.0 release

These items track repository-owner and rights-holder governance decisions.

## 1. Protect the default branch

**Status: COMPLETED**  
**Observed state:** GitHub ruleset `Protect Main` (ruleset ID `27612394`) is active on `~DEFAULT_BRANCH` (`main`).
Enforced rules:
- Requires pull requests for changes to `main`.
- Requires review thread resolution before merge (`required_review_thread_resolution: true`).
- Blocks force pushes (`non_fast_forward`).
- Blocks branch deletion (`deletion`).

Rules not configured in the active ruleset:
- Linear history is not required (`allowed_merge_methods` permits `merge`, `squash`, and `rebase`).
- CODEOWNERS approval is not enforced (`require_code_owner_review: false`, `required_approving_review_count: 0`), preserving single-owner operations without self-blocking.
- Required status checks are not currently configured (see Section 7 for owner option).

## 2. Enable dependency graph access and scanner execution

**Status: COMPLETED**  
**Observed state:** Dependency graph is enabled on the repository.
- A pinned `package.json` and `package-lock.json` for `yaml@2.9.1` has been committed, resolving the previous empty-lockfile concern with zero OSV vulnerabilities verified against the OSV API.
- Continuous security scanning workflows are operational: Gitleaks full-history scanning, Semgrep SAST (pinned by immutable SHA256 digest `semgrep/semgrep:1.186.0@sha256:25251de66c3b0fdea1c1c519bbc130170349f3da79edd517335b847f30d3c493`), CodeQL, and OSV-Scanner.

## 3. Choose a software licence

**Status: COMPLETED**  
**Observed state:** Personal Non-Commercial Use Licence (PNCUL 1.0) was selected and published in `LICENSE` (PR #4).
- The repository owner (Jude O. Richard / Jay Bliss Tech Limited) has explicitly confirmed authorization for commercial use of his original USS intellectual property in his own commercial applications, including Choir SaaS.
- The licence remains strictly unmodified during this engineering assignment.

## 4. Establish release signing

**Status: COMPLETED**  
**Observed state:** Owner SSH release-signing identity is established and published in `SECURITY-ROOT.md`, `SECURITY-ROOT.pub`, and `.security/allowed_signers`.
- Signing identity: `jude_m2003@yahoo.com`
- Public key fingerprint: `SHA256:zfXCAflnGbD1984rV8kabaPj92UyXIs0gCVsIspIX/o`
- Deterministic checksum and signature verification tooling is implemented in `tools/checksums.mjs`, supporting both Git working trees and extracted release archives.
- Final release tag `v1.0.0` and SHA256SUMS.sig will be signed by the owner personally before publication.

## 5. Repository naming decision

**Status: COMPLETED**  
**Observed state:** The repository has been renamed from `seurity-layer` to `security-governance-framework`.
- Authoritative URL: `https://github.com/jflowdking212/security-governance-framework`
- All documentation, clone commands, and consuming references have been updated.

## 6. Release signing ceremony (U-01)

**Status:** OWNER ACTION REQUIRED (NOT EXECUTED BY AGENTS)

**Current repository state (2026-11-25):**
- `main` HEAD: `53d45c2fee0fa2664fdc4e4c3372ac8971ed959d` (PR #11 merged `1bb8a6ef04006b0030c989ca8029f2a0d4f70407`, PR #12 merged `23d1047add2c52eab4a0c84f6760d30a8a8fd17a`, PR #13 merged `53d45c2fee0fa2664fdc4e4c3372ac8971ed959d`; hosted `main` CI runs `45598306667` [`USS validation`] and `45598307399` [`USS security scans`] succeeded).
- Technical remediation candidate branch: `gemini/v1-release-readiness` (technical code/test closure for Claude's Nov 25 findings F-1 through F-7 verified at `68c373f2e0eb0474c718ceb03cae4a8b5cb53ab3`, followed by documentation reconciliation commits; final branch CI run IDs are recorded on push).
- Legacy open PRs `#3`, `#8`, and `#9` pre-date PR #11 on `main`; PR `#6` (`actions/checkout` v7.0.1) and PR `#7` (`actions/setup-node` v7.1.0) are open Dependabot PRs. Draft PR `#10` was closed without merge.
- No official `v1.0.0` release commit, `SHA256SUMS.sig`, or signed tag has been created. Gemini verified the signing workflow on Linux VPS (`~/uss-verify/signing-dryrun`) using a disposable keypair outside the repository, confirming checksum creation, tamper rejection, detached `USS-SHA256SUMS` verification, bundle manifest signing, and signed commit/tag verification (`exit 0`); the disposable artifacts were immediately deleted.

> Historical note: earlier Nov 20 notes referenced `integration/uss-pr3-pr8-hardening`, PR #9, and pre-merge `a52b22e...`. Those steps were superseded by PR #11's merge to `main` and by this release-readiness pass (`REVIEW-CORRECTION-LOG.md`).

To finalize the official `v1.0.0` release once `gemini/v1-release-readiness` passes hosted CI and any owner-directed independent review:
1. Owner reviews and merges the approved `gemini/v1-release-readiness` PR into `main` (and closes/dispositions legacy PRs `#3`, `#8`, `#9` and Dependabot PRs `#6`, `#7`).
2. Optionally apply the `Protect Main` `required_status_checks` update in Section 7 before or immediately around merge.
3. On the owner's trusted workstation (where `~/.ssh/security_layer_signing` resides):
   ```sh
   git checkout main
   git pull --ff-only origin main
   npm ci --ignore-scripts --no-audit --no-fund
   node tools/build-modules.mjs && git diff --exit-code -- modules/
   node tools/build-indexes.mjs && git diff --exit-code -- MODULE-INDEX.md bundles/
   node tools/build-bundles.mjs
   node tools/validate.mjs
   node tools/validate-consumer-workflow.mjs
   node tools/checksums.mjs create
   node tools/checksums.mjs create --root dist/bundles --filesystem
   ssh-keygen -Y sign -f ~/.ssh/security_layer_signing -n USS-SHA256SUMS SHA256SUMS
   ssh-keygen -Y sign -f ~/.ssh/security_layer_signing -n USS-SHA256SUMS dist/bundles/SHA256SUMS
   ssh-keygen -Y verify -f .security/allowed_signers -I jude_m2003@yahoo.com -n USS-SHA256SUMS -s SHA256SUMS.sig < SHA256SUMS
   ssh-keygen -Y verify -f .security/allowed_signers -I jude_m2003@yahoo.com -n USS-SHA256SUMS -s dist/bundles/SHA256SUMS.sig < dist/bundles/SHA256SUMS
   node tools/checksums.mjs verify
   node tools/checksums.mjs verify --root dist/bundles --filesystem
   git add SHA256SUMS SHA256SUMS.sig
   git commit -S -m "release: Universal Security Standard v1.0.0"
   git tag -s -m "Universal Security Standard v1.0.0" v1.0.0
   git verify-commit HEAD
   git verify-tag v1.0.0
   git push origin main v1.0.0
   ```
4. Publish the GitHub Release for tag `v1.0.0` (attaching `dist/bundles/*.md`, `dist/bundles/SHA256SUMS`, and `dist/bundles/SHA256SUMS.sig`) and verify signatures and release assets on GitHub.

## 7. Main branch required status checks (U-08)

**Status:** OWNER ACTION REQUIRED (NOT APPLIED BY AGENTS)
- The active `Protect Main` ruleset (ID `27612394`) currently configures `deletion`, `non_fast_forward`, and `pull_request` (`required_approving_review_count: 0`, `required_review_thread_resolution: true`). It has **no** `required_status_checks` rule configured.
- In accordance with the owner's directive, `required_approving_review_count: 0` MUST remain disabled to preserve single-owner operation.
- Inspection of live GitHub check runs on `main` (`53d45c2f`, runs `45598306667` / `45598307399`) and PR #13 (`7ecdcc75`, runs `45597772700` / `45597773063`) shows that GitHub Rulesets match individual **check-run context names** under GitHub Actions (`integration_id: 15368`), NOT the workflow display names (`USS validation` / `USS security scans`). Both workflows trigger unconditionally on `pull_request` targeting `main` with no `paths` exclusions, so all 5 job check contexts are eligible as mandatory status checks:
  1. `validate` (from `USS validation`)
  2. `Secret scan (commit range on push/PR, full history on schedule)` (from `USS security scans`)
  3. `Semgrep static analysis` (from `USS security scans`)
  4. `CodeQL JavaScript/TypeScript and GitHub Actions analysis` (from `USS security scans`)
  5. `OSV dependency vulnerability scan / osv-scan` (from `USS security scans`)
- Note: SARIF upload checks (`CodeQL`, `osv-scanner` under `app_id: 57789`) appear when SARIF alerts upload on PRs rather than standalone job names; requiring `integration_id: 15368` on the 5 GitHub Actions contexts above ensures consistent enforcement on every PR to `main`.
- Exact payload for the owner to apply (`strict_required_status_checks_policy: true` ensures branches are re-tested against current `main` before merge):
  ```json
  {
    "name": "Protect Main",
    "target": "branch",
    "enforcement": "active",
    "conditions": { "ref_name": { "exclude": [], "include": ["~DEFAULT_BRANCH"] } },
    "rules": [
      { "type": "deletion" },
      { "type": "non_fast_forward" },
      {
        "type": "pull_request",
        "parameters": {
          "required_approving_review_count": 0,
          "dismiss_stale_reviews_on_push": false,
          "required_reviewers": [],
          "require_code_owner_review": false,
          "require_last_push_approval": false,
          "required_review_thread_resolution": true,
          "require_extra_approval_for_unattributed_changes": false,
          "allowed_merge_methods": ["merge", "squash", "rebase"]
        }
      },
      {
        "type": "required_status_checks",
        "parameters": {
          "strict_required_status_checks_policy": true,
          "do_not_enforce_on_create": false,
          "required_status_checks": [
            { "context": "validate", "integration_id": 15368 },
            { "context": "Secret scan (commit range on push/PR, full history on schedule)", "integration_id": 15368 },
            { "context": "Semgrep static analysis", "integration_id": 15368 },
            { "context": "CodeQL JavaScript/TypeScript and GitHub Actions analysis", "integration_id": 15368 },
            { "context": "OSV dependency vulnerability scan / osv-scan", "integration_id": 15368 }
          ]
        }
      }
    ]
  }
  ```
- No repository ruleset settings were modified by Gemini.

## Release rule (2026-11-25)

The `v1.0.0-rc.1` candidate on `gemini/v1-release-readiness` is **NOT YET RELEASE-SIGNED OR OWNER-APPROVED**.
- **IMPLEMENTED & VERIFIED (branch implementation `68c373f`):** Claude's Nov 25 findings F-1 through F-7 are implemented with regression tests; Linux VPS passed `317/317` tests (`0` fail, `0` skipped) and disposable-key Section 8 signing dry run passed.
- **NOT VERIFIED:** Consuming-application stack verification (`stacks/*.md` remain `REFERENCE ONLY - NOT VERIFIED`), runtime Safari/WebKit LNA release status, and hosted GitHub Actions CI + final independent review on the documentation-reconciled final commit of `gemini/v1-release-readiness` until pushed and completed.
- **OWNER ACTION REQUIRED:** PR merge into `main`, `Protect Main` `required_status_checks` configuration (`U-08`), legacy PR `#3`/`#8`/`#9` & Dependabot `#6`/`#7` disposition, and the `U-01` production SSH signing & `v1.0.0` release ceremony.
