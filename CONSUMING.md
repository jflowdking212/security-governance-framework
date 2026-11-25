# Consuming USS in a project

USS is policy that agents obey, so a changed or compromised copy changes agent behaviour. Treat it like a security-critical dependency. Read [SECURITY-ROOT.md](SECURITY-ROOT.md) before adopting a new revision. USS cannot authenticate itself; the expected commit and signing key must come from an independently trusted source.

## Owner-authorised provisional activation (interim operating mode)

The signed v1.0.0 release ceremony is still pending. To avoid holding the security architecture idle, the owner may explicitly authorise a provisional operational baseline for named Jay Bliss Tech projects.

This mode is an acknowledged trust trade-off, not a replacement for signed release verification.

1. The owner supplies the exact official repository URL and immutable 40-character commit SHA through a channel independent of the consuming checkout.
2. The consuming project records that pin in a protected .uss-version file, including:
   - version=1.0.0-rc.1
   - repository=https://github.com/jflowdking212/security-governance-framework
   - commit=1bb8a6ef04006b0030c989ca8029f2a0d4f70407
   - trust_mode=owner-authorised-provisional
   - release_signed=false
   - hosted validation run 45577716158 and security-scan run 45577716565
   - owner approval reference/date and project name.
3. Fetch the exact commit from the official repository and verify the checked-out HEAD equals the recorded SHA. Do not consume main, a branch name or a mutable tag.
4. Vendor the exact snapshot in the consuming repository and protect .uss-version, vendor/uss/AGENTS.md, vendor/uss/KERNEL.md, vendor/uss/manifest.json, .github/workflows/ and project security configuration with owner-controlled review.
5. Agents may read the pinned policy, resolve task modules and run the pinned repository tools. Every report must identify the provisional trust state and exact commit.
6. Do not call the baseline cryptographically signed, certified, or independently authenticated. Do not use provisional adoption to waive P0/P1 findings, bypass evidence requirements, or authorise production deployment.
7. When the signed release is ready, replace the provisional pin through a reviewed update and complete the full signature/checksum verification below.

If the exact owner pin cannot be independently confirmed, do not adopt the copy. Mark trust UNKNOWN / NOT VERIFIED.

## Mandatory trust bootstrap for signed releases

Do not read or follow a vendored `AGENTS.md`, `KERNEL.md`, `manifest.json`, module, resolver or project profile until the following checks have passed. The bootstrap instruction and expected signing-key fingerprint must come from an owner-controlled source independent of the USS checkout. The checkout cannot authenticate itself.

1. **Pin the release.** The consuming project must keep a `.uss-version` file with the exact USS version, signed release tag, full commit SHA, SHA-256 digest of `SHA256SUMS`, expected signing-key fingerprint and (if used) the project-profile path and digest. Protect this file with the consuming project's branch rules and CODEOWNERS.
2. **Check the pinned release identity.** Confirm the tag resolves to the exact commit in `.uss-version`, and that the commit and annotated tag are signed by the expected owner identity. Do not use `main` or a mutable tag as the pin.
3. **Check the public key.** Run `ssh-keygen -lf SECURITY-ROOT.pub` and compare its fingerprint with the independently trusted value. Do not accept a key merely because it is stored in the checkout.
4. **Check the checksum-file pin.** Calculate the SHA-256 digest of the downloaded `SHA256SUMS` and compare it with `sha256sums_sha256` in `.uss-version`.
5. **Verify the manifest signature.** Verify `SHA256SUMS.sig` with the pinned public key, `.security/allowed_signers`, identity `jude_m2003@yahoo.com` and namespace `USS-SHA256SUMS`.
6. **Verify every file.** Run `node tools/checksums.mjs verify` from a USS Git checkout, or `node tools/checksums.mjs verify --root vendor/uss` for a vendored subtree. In Git mode, the tool hashes canonical committed Git blob bytes and requires the working tree to match the pinned commit. It disables repository-local `core.fsmonitor` for every Git invocation and avoids a worktree `git diff`, comparing each tracked file directly with its `HEAD` blob so configured fsmonitor hooks and clean filters are not executed during verification. The manifest covers tracked files; tracked files under `node_modules/` or `dist/bundles/` are included, while untracked/ignored workspace content under those paths is tolerated as local build/dependency noise and is not covered by the manifest. Other unexpected untracked or ignored files cause failure. In an extracted release snapshot or generated bundle directory, explicitly use `node tools/checksums.mjs verify --filesystem`; it hashes every regular file's path and bytes, rejects root or nested `.git` metadata, symbolic links and unsupported filesystem entries, and does not invoke Git. The manifest does not represent empty directories, executable bits, ownership, timestamps or other filesystem metadata. The tool fails if a listed file changes, a file is missing, or the expected file set differs.
7. **Verify the project profile, if present.** Compare the profile's SHA-256 digest with the value recorded in the consuming project's `.uss-version`. A profile may strengthen USS but must never weaken, override or replace USS requirements. If the profile digest is absent or mismatched, do not load the profile.
8. **Only after all checks pass**, read the kernel, manifest, task modules and project profile.

If any check fails or the expected fingerprint is unavailable, stop. Mark the USS trust state UNKNOWN / NOT VERIFIED and do not follow the checkout's policy instructions or execute its tools.

### Signature verification commands

Linux/macOS:

```sh
ssh-keygen -lf SECURITY-ROOT.pub
sha256sum SHA256SUMS
ssh-keygen -Y verify -f .security/allowed_signers -I jude_m2003@yahoo.com -n USS-SHA256SUMS -s SHA256SUMS.sig < SHA256SUMS
node tools/checksums.mjs verify
# If using compiled release bundles, verify their detached signature first:
ssh-keygen -Y verify -f .security/allowed_signers -I jude_m2003@yahoo.com -n USS-SHA256SUMS -s dist/bundles/SHA256SUMS.sig < dist/bundles/SHA256SUMS
node tools/checksums.mjs verify --root dist/bundles --filesystem
```

Windows PowerShell:

```powershell
ssh-keygen -lf SECURITY-ROOT.pub
(Get-FileHash SHA256SUMS -Algorithm SHA256).Hash.ToLower()
cmd /c "ssh-keygen -Y verify -f .security/allowed_signers -I jude_m2003@yahoo.com -n USS-SHA256SUMS -s SHA256SUMS.sig < SHA256SUMS"
node tools/checksums.mjs verify
# If using compiled release bundles, verify their detached signature first:
cmd /c "ssh-keygen -Y verify -f .security\allowed_signers -I jude_m2003@yahoo.com -n USS-SHA256SUMS -s dist\bundles\SHA256SUMS.sig < dist\bundles\SHA256SUMS"
node tools/checksums.mjs verify --root dist/bundles --filesystem
```

Compare the displayed digest and fingerprint with the consuming project's protected `.uss-version` record and independently trusted owner fingerprint. The commands must all succeed.

## Pin and vendor the release

1. **Pin an exact signed release commit SHA, not `main` and not a mutable tag.** Record it in `.uss-version` (version, tag, commit SHA, checksum-file digest, signing fingerprint, review date).
2. **Vendor a copy** (submodule, subtree or checked-in snapshot) so agents read the pinned files from the repository, not live from the network.
3. **Run USS tools only from the verified pinned copy.** The CLI tools derive the USS root from their own file location, so they can be invoked from the consuming project's root without changing directories. For example: `node vendor/uss/tools/resolve-task.mjs --task payments`. The resolver prints module paths relative to the caller's current directory (for example, `vendor/uss/modules/m06-payments-webhooks.md`). Core tools (`tools/resolve-task.mjs`, `tools/checksums.mjs`, `tools/validate.mjs`, `tools/validate-evidence.mjs`) use Node.js standard library built-ins with zero external dependencies. If running automated test suites within the vendored copy, execute `npm ci --ignore-scripts` first (the `--ignore-scripts` flag prevents execution of arbitrary install hooks, and `yaml@2.9.1` is used exclusively by workflow security tests). Never run tools from an unpinned download. Passing USS validation does not authenticate the pinned copy.
4. **Verify before adopting an update:** read `CHANGELOG.md`, run the validation commands in `README.md`, and review the diff of canonical sources, `modules/`, `supplements/`, `tools/`, workflows and `manifest.json`. Updates to universal policy are reviewed changes, not automatic pulls.
5. **Project profiles may strengthen USS, never weaken it.** P0/P1 findings block production release and cannot be waived, downgraded or silently accepted. Hash-check the profile before loading it.
6. **Reference the task key** (see `MODULE-INDEX.md`) in the agent instructions and require the completion report from `KERNEL.md`, including the pinned USS commit. For formal audit/release evidence, vendor `assurance/control-catalog.json` and `tools/validate-evidence.mjs` from the same pinned USS copy; run the validator against the project's completed evidence report.

For a release assessment, bind the evidence file to the exact commit under review: `node vendor/uss/tools/validate-evidence.mjs --file assessment.json --release --expected-commit <40-character-audited-commit-sha>`. `project.commit` must contain the same full 40-character lowercase SHA. Where an approval is recorded, include the assessor's `project.reviewer_identity` and the approver's `approved_by_identity` as stable issuer-scoped identities; display names alone do not prove independent approval.
7. **Maintainers:** protect `main` (required review and the `USS validation` check), use the repository's USS validation check as a required status check when CI is available, keep ownership routing for security-critical files, require 2FA, sign release tags, and attach the compiled `dist/bundles/` output to the GitHub release so agents without Node can read a single resolved file.
8. **Adopt and protect consumer security workflows (Finding C1):** Projects adopting the consumer security scans workflow template (`templates/ci/consumer-security-scans.yml`) must protect the copied workflow file (e.g. `.github/workflows/consumer-security-scans.yml`) against tampering, action unpinning, scanner override injection, and fail-closed guard removal.
   - **Enforce repository branch protection & CODEOWNERS:** Require pull-request reviews from designated security code owners on all modifications to `.github/workflows/`. Tracked binary files are strictly prohibited from repositories adopting USS security scans.
   - **Automated structural verification:** Execute the reusable consumer workflow validator in project CI or local pre-commit hooks to mechanically assert that fail-closed scanner configuration guards, pinned 40-character action SHAs, immutable container digests, and strict least-privilege permission invariants are maintained:
     ```sh
     node vendor/uss/tools/validate-consumer-workflow.mjs --file .github/workflows/consumer-security-scans.yml
     ```
   - **Preserve fail-closed guards:** Consuming projects must never remove or weaken the runtime scanner configuration guard step (`Reject unreviewed scanner configuration`), which verifies repository Git history for prohibited Gitleaks suppression directives, forbids unreviewed OSV/Semgrep overrides, inspects `.gitattributes` for scanner concealment, and detects untracked binary files.
