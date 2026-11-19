# Consuming USS in a project

USS is policy that agents obey, so a changed or compromised copy changes agent behaviour. Treat it like a security-critical dependency. Read [SECURITY-ROOT.md](SECURITY-ROOT.md) before adopting a new revision. USS cannot authenticate itself; the expected commit and signing key must come from an independently trusted source.

## Mandatory trust bootstrap before reading USS policy

Do not read or follow a vendored `AGENTS.md`, `KERNEL.md`, `manifest.json`, module, resolver or project profile until the following checks have passed. The bootstrap instruction and expected signing-key fingerprint must come from an owner-controlled source independent of the USS checkout. The checkout cannot authenticate itself.

1. **Pin the release.** The consuming project must keep a `.uss-version` file with the exact USS version, signed release tag, full commit SHA, SHA-256 digest of `SHA256SUMS`, expected signing-key fingerprint and (if used) the project-profile path and digest. Protect this file with the consuming project's branch rules and CODEOWNERS.
2. **Check the pinned release identity.** Confirm the tag resolves to the exact commit in `.uss-version`, and that the commit and annotated tag are signed by the expected owner identity. Do not use `main` or a mutable tag as the pin.
3. **Check the public key.** Run `ssh-keygen -lf SECURITY-ROOT.pub` and compare its fingerprint with the independently trusted value. Do not accept a key merely because it is stored in the checkout.
4. **Check the checksum-file pin.** Calculate the SHA-256 digest of the downloaded `SHA256SUMS` and compare it with `sha256sums_sha256` in `.uss-version`.
5. **Verify the manifest signature.** Verify `SHA256SUMS.sig` with the pinned public key, `.security/allowed_signers`, identity `jude_m2003@yahoo.com` and namespace `USS-SHA256SUMS`.
6. **Verify every file.** Run `node tools/checksums.mjs verify` from a USS Git checkout, or `node tools/checksums.mjs verify --root vendor/uss` for a vendored subtree. In a Git checkout, the tool hashes canonical committed Git blob bytes and requires the working tree to match the pinned commit. In an extracted release snapshot, run the tool from the extracted USS root; it hashes the snapshot's file bytes. The tool fails if a listed file changes, a file is missing, or the tracked/file set differs.
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
3. **Run USS tools only from the verified pinned copy.** The six CLI tools derive the USS root from their own file location, so they can be invoked from the consuming project's root without changing directories. For example: `node vendor/uss/tools/resolve-task.mjs --task payments`. The resolver prints module paths relative to the caller's current directory (for example, `vendor/uss/modules/m06-payments-webhooks.md`). Build, index, bundle and validation outputs remain inside the pinned USS copy. Never run tools from an unpinned download. Passing USS validation does not authenticate the pinned copy.
4. **Verify before adopting an update:** read `CHANGELOG.md`, run the validation commands in `README.md`, and review the diff of canonical sources, `modules/`, `supplements/`, `tools/`, workflows and `manifest.json`. Updates to universal policy are reviewed changes, not automatic pulls.
5. **Project profiles may strengthen USS, never weaken it.** P0/P1 findings block production release and cannot be waived, downgraded or silently accepted. Hash-check the profile before loading it.
6. **Reference the task key** (see `MODULE-INDEX.md`) in the agent instructions and require the completion report from `KERNEL.md`, including the pinned USS commit. For formal audit/release evidence, vendor `assurance/control-catalog.json` and `tools/validate-evidence.mjs` from the same pinned USS copy; run the validator against the project's completed evidence report.
7. **Maintainers:** protect `main` (required review and the `USS validation` check), use the repository's USS validation check as a required status check when CI is available, keep ownership routing for security-critical files, require 2FA, sign release tags, and attach the compiled `dist/bundles/` output to the GitHub release so agents without Node can read a single resolved file.
