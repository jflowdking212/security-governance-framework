# Consuming USS in a project

USS is policy that agents obey, so a changed or compromised copy changes agent behaviour. Treat it like a dependency.

1. **Pin an exact commit SHA, not `main` and not a mutable tag.** Record it in the project as `.uss-version` (version, commit SHA, date reviewed).
2. **Vendor a copy** (submodule, subtree or checked-in snapshot) so agents read the pinned files from the repository, not live from the network.
3. **Run USS tools only from the pinned copy.** The five CLI tools derive the USS root from their own file location, so they can be invoked from the consuming project's root without changing directories. For example: `node vendor/uss/tools/resolve-task.mjs --task payments`. The resolver prints module paths relative to the caller's current directory (for example, `vendor/uss/modules/m06-payments-webhooks.md`). Build, index, bundle and validation outputs remain inside the pinned USS copy. Never run tools from an unpinned download.
4. **Verify before adopting an update:** read `CHANGELOG.md`, run the validation commands in `README.md`, and review the diff of `modules/` and `manifest.json`. Updates to universal policy are reviewed changes, not automatic pulls.
5. **Project profiles may strengthen USS, never weaken it.** P0/P1 findings block production release and cannot be waived, downgraded or silently accepted.
6. **Reference the task key** (see `MODULE-INDEX.md`) in the agent instructions and require the completion report from `KERNEL.md`, including the pinned USS commit. For formal audit/release evidence, vendor `assurance/control-catalog.json` and `tools/validate-evidence.mjs` from the same pinned USS copy; run the validator against the project's completed evidence report.
7. **Maintainers:** protect `main` (required review and the `USS validation` check), require 2FA, sign release tags, and attach the compiled `dist/bundles/` output to the GitHub release so agents without Node can read a single resolved file.
