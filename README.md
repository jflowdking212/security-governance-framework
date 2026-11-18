# Universal Security Standard (USS)

USS is a modular, agent-readable security and secure-engineering standard derived from the preserved source directives in `source/original-directives/`.

**Current version:** 1.0.0  
**Status:** Initial release candidate, pending independent review and validation in consuming projects.  
**Policy:** FAIL CLOSED & PROVE.

## Start here

1. Read [AGENTS.md](AGENTS.md).
2. Read [KERNEL.md](KERNEL.md).
3. Identify the task type and load its generated bundle from `bundles/`.
4. Resolve dependencies from [manifest.json](manifest.json).
5. Apply the relevant module controls and produce evidence.

For a complete security audit, use `bundles/full-audit.md`. Do not select a subset for a full audit.

## Structure

- `KERNEL.md`: mandatory short policy and routing rules.
- `modules/`: authoritative modular controls.
- `assurance/`: 13-layer assessment, severity, evidence, testing, and remediation lifecycle.
- `bundles/`: generated task-specific concatenations.
- `adapters/`: minimal agent entrypoints.
- `stacks/`: stack-specific additions, only where verified.
- `templates/`: audit and remediation templates.
- `source/original-directives/`: verbatim historical source documents.
- `source/traceability-matrix.csv`: source-to-module mapping.
- `manifest.json`: module IDs, triggers, dependencies, bundle definitions, and source references.
- `tools/`: bundle builder and validator.
- `tests/`: automated structural and policy tests.

## Policy interpretation

The source directives are the authority for inherited controls. The new modular documents reorganize and consolidate those controls. Where a module is more specific, it must not weaken the source directive. If a conflict or ambiguity is found, record it as an issue and fail closed until an accountable human resolves it.

### Release blockers

P0 and P1 findings block production release. No agent may waive or downgrade them. P2 findings require documented remediation or explicit human risk handling appropriate to the deployment. P3 findings are informational.

### Assurance naming

The source's APES-style 13-layer framework is retained as the **13-Layer Security Assurance Model**. This is an internal assurance model, not a claim of external certification or a universal standard.

## Build and validate

Requires Node.js 18 or later. No third-party packages are required.

```sh
node tools/build-bundles.mjs
node tools/validate.mjs
node --test tests/*.test.mjs
```

The bundle builder reads `manifest.json`, resolves declared dependencies, and writes deterministic Markdown bundles. Do not edit generated bundles by hand.

## Version pinning

Consuming projects should pin a released tag or commit SHA and retain the pinned version in their repository. Do not rely on a moving branch or a live network fetch during every agent task.

## Scope and limitations

USS is an engineering policy and verification framework. It does not itself prove that a system is secure, compliant, penetration-tested, or production-ready. Controls must be verified against the actual application, configuration, infrastructure, tests, and operational evidence.
