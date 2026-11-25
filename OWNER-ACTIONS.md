# Owner actions required before USS v1.0.0 release

These items track repository-owner and rights-holder governance decisions.

## 1. Protect the default branch

**Status: COMPLETED**
**Observed state:** GitHub ruleset `Protect Main` (ruleset ID `27612394`, updated `2026-11-25T14:58:22.193+01:00`) is active on `~DEFAULT_BRANCH` (`main`).
Enforced rules:
- Requires pull requests for changes to `main`.
- Requires review thread resolution before merge (`required_review_thread_resolution: true`).
- Blocks force pushes (`non_fast_forward`).
- Blocks branch deletion (`deletion`).
- Enforces five mandatory GitHub Actions status check contexts (`integration_id: 15368`, `strict_required_status_checks_policy: true`, `do_not_enforce_on_create: false`):
  1. `validate` (`USS validation`)
  2. `Secret scan (commit range on push/PR, full history on schedule)` (`USS security scans`)
  3. `Semgrep static analysis` (`USS security scans`)
  4. `CodeQL JavaScript/TypeScript and GitHub Actions analysis` (`USS security scans`)
  5. `OSV dependency vulnerability scan / osv-scan` (`USS security scans`)

Rules not configured in the active ruleset:
- Linear history is not required (`allowed_merge_methods` permits `merge`, `squash`, and `rebase`).
- CODEOWNERS approval and mandatory second-person approvals remain intentionally disabled (`require_code_owner_review: false`, `required_approving_review_count: 0`), preserving single-owner operations without self-blocking.
- `bypass_actors` is empty (`current_user_can_bypass: "never"`), so even release commits must merge through a PR after all five required checks pass.

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
- `main` HEAD: `f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda` (PR #14 merged `gemini/v1-release-readiness` `fb18d09581813e8213314cdbc611041bd70ea1bd`, following PR #11 `1bb8a6ef04006b0030c989ca8029f2a0d4f70407`, PR #12 `23d1047add2c52eab4a0c84f6760d30a8a8fd17a`, and PR #13 `53d45c2fee0fa2664fdc4e4c3372ac8971ed959d`).
- Post-merge hosted `main` CI at `f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda`: `USS validation` run `45631844618` (`validate` job `139266840160`, `317/317` passed) and `USS security scans` run `45631845175` (jobs `139266841693`, `139266841566`, `139266841092`, `139266841767`) all succeeded; explicit full-history Gitleaks (`gitleaks 8.21.2`) on Linux VPS scanned `19` commits on `HEAD` and `664` commits across `--all` with `0` leaks.
- Release preparation branch: `release/v1.0.0` (contains unsigned `1.0.0` metadata preparation awaiting owner cryptographic signing; `manifest.json` remains `"status": "awaiting-owner-signing"`).
- Legacy/dependency open PRs still awaiting owner closure disposition: `#3`, `#8`, `#9` (superseded), plus `#6` and `#7` (Dependabot bumps failing `workflow-security.test.mjs` pinned SHAs). Draft PR `#10` is closed.
- No official `v1.0.0` release commit, `SHA256SUMS.sig`, or signed tag has been created.

> Historical note: earlier Nov 20 notes referenced `integration/uss-pr3-pr8-hardening`, pre-merge `a52b22e...`, initial operational activation `1bb8a6ef...`, and candidate PR #14 (`fb18d095...`). All are superseded by `main` `f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda` and preserved in `REVIEW-CORRECTION-LOG.md`.

To finalize the official `v1.0.0` release on your trusted **Linux / WSL2** workstation (where `~/.ssh/security_layer_signing` resides; `tools/checksums.mjs` requires Linux `/proc/self/fd` and `/usr/bin/git` and fails closed on Windows/macOS):
1. Check out prepared `release/v1.0.0` cleanly and verify pre-signing validation:
   ```sh
   git fetch origin --prune
   git checkout -B release/v1.0.0 origin/release/v1.0.0
   npm ci --ignore-scripts --no-audit --no-fund
   node tools/build-modules.mjs && git diff --exit-code -- modules/
   node tools/build-indexes.mjs && git diff --exit-code -- MODULE-INDEX.md bundles/
   node tools/build-bundles.mjs
   node tools/validate.mjs
   node tools/validate-consumer-workflow.mjs
   node tools/validate-evidence.mjs --file templates/security-evidence.example.json
   ssh-keygen -lf SECURITY-ROOT.pub
   # Expected: SHA256:zfXCAflnGbD1984rV8kabaPj92UyXIs0gCVsIspIX/o
   ```
2. Generate and SSH-sign `SHA256SUMS` (repository root) and `dist/bundles/SHA256SUMS` (`--filesystem`), verify before commit:
   ```sh
   node tools/checksums.mjs create
   node tools/checksums.mjs create --root dist/bundles --filesystem
   ssh-keygen -Y sign -f ~/.ssh/security_layer_signing -n USS-SHA256SUMS SHA256SUMS
   ssh-keygen -Y sign -f ~/.ssh/security_layer_signing -n USS-SHA256SUMS dist/bundles/SHA256SUMS
   ssh-keygen -Y verify -f .security/allowed_signers -I jude_m2003@yahoo.com -n USS-SHA256SUMS -s SHA256SUMS.sig < SHA256SUMS
   ssh-keygen -Y verify -f .security/allowed_signers -I jude_m2003@yahoo.com -n USS-SHA256SUMS -s dist/bundles/SHA256SUMS.sig < dist/bundles/SHA256SUMS
   node tools/checksums.mjs verify
   node tools/checksums.mjs verify --root dist/bundles --filesystem
   ```
3. Commit signed manifests, push `release/v1.0.0`, open PR to `main`, and merge via **`--merge`** once all five `Protect Main` required checks pass *(because `bypass_actors: []` blocks direct `main` pushes; avoid `--squash`/`--rebase`, which strip local commit signatures)*:
   ```sh
   git add SHA256SUMS SHA256SUMS.sig
   git commit -S -m "release: Universal Security Standard v1.0.0"
   git -c gpg.ssh.allowedSignersFile=.security/allowed_signers verify-commit HEAD
   git push -u origin release/v1.0.0
   gh pr create --base main --head release/v1.0.0 --title "release: Universal Security Standard v1.0.0" --body "Signed release manifests for USS v1.0.0."
   ```
4. Pull merged `main`, re-verify checksums, create and push signed annotated `v1.0.0` tag, and publish the GitHub Release (attaching `dist/bundles/*.md`, `dist/bundles/SHA256SUMS`, and `dist/bundles/SHA256SUMS.sig`):
   ```sh
   git checkout main && git pull --ff-only origin main
   node tools/build-bundles.mjs
   node tools/checksums.mjs verify
   ssh-keygen -Y verify -f .security/allowed_signers -I jude_m2003@yahoo.com -n USS-SHA256SUMS -s SHA256SUMS.sig < SHA256SUMS
   git tag -s -m "Universal Security Standard v1.0.0" v1.0.0
   git -c gpg.ssh.allowedSignersFile=.security/allowed_signers verify-tag v1.0.0
   git push origin v1.0.0
   ```

## 7. Main branch required status checks (U-08)

**Status:** COMPLETED (OWNER AUTHORISED, `2026-11-25T14:58:22.193+01:00`)
- Active `Protect Main` ruleset (ID `27612394`) now enforces `deletion`, `non_fast_forward`, `pull_request` (`required_approving_review_count: 0`, `required_review_thread_resolution: true`), and `required_status_checks` (`strict_required_status_checks_policy: true`, `do_not_enforce_on_create: false`) across all five GitHub Actions contexts (`integration_id: 15368`):
  1. `validate` (from `USS validation`)
  2. `Secret scan (commit range on push/PR, full history on schedule)` (from `USS security scans`)
  3. `Semgrep static analysis` (from `USS security scans`)
  4. `CodeQL JavaScript/TypeScript and GitHub Actions analysis` (from `USS security scans`)
  5. `OSV dependency vulnerability scan / osv-scan` (from `USS security scans`)
- Ruleset backup (`1,051` bytes) and post-update verification (`17/17` structural checks passed) were performed cleanly without modifying `required_approving_review_count: 0` or `bypass_actors: []`:
  ```json
  {
    "name": "Protect Main",
    "target": "branch",
    "enforcement": "active",
    "bypass_actors": [],
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

## Release rule (2026-11-25)

USS `1.0.0` on branch `release/v1.0.0` (derived from `main` `f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda`) contains unsigned version-preparation updates only and is **NOT YET RELEASE-SIGNED OR PUBLISHED**.
- **IMPLEMENTED & VERIFIED:** PR #14 merged at `f584ab95b6e06ca8c326cdf4d94f761b8ed5fdda`; post-merge `main` CI runs `45631844618` (`317/317`) & `45631845175` + full-history Gitleaks (`0` leaks) passed; `Protect Main` (`27612394`) enforces all five required checks (`U-08` complete); Linux VPS simulated `1.0.0` + `--merge` signing dry run passed (`317/317`).
- **NOT VERIFIED:** Consuming-application conformance (`stacks/*.md` remain `REFERENCE ONLY - NOT VERIFIED`), shipped Safari/WebKit LNA release status, and hosted CI on the final unsigned `release/v1.0.0` version-preparation commit until pushed and completed.
- **OWNER ACTION REQUIRED:** Review `release/v1.0.0` changes, execute the workstation SSH signing ceremony (`U-01`), merge the signed-manifest PR via `--merge` into `main`, tag `v1.0.0`, publish the GitHub Release, and close superseded/failing open PRs (`#3`, `#6`, `#7`, `#8`, `#9`).
