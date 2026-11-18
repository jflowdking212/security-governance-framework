# Universal Security Standard (USS)

**Version:** 1.0.0  
**Status:** Review-ready candidate, pending independent Claude review and owner approval.  
**Operating rule:** FAIL CLOSED & PROVE.

USS converts the preserved global application-security, Anti-Gravity execution and payment/tax directives into small, source-traceable modules. Agents should load the kernel plus only the task module(s) and their dependencies, not the entire source archive.

## Start here
1. Read `AGENTS.md` and `KERNEL.md`.
2. Find the task key in `MODULE-INDEX.md` / `manifest.json`.
3. Run `node tools/resolve-task.mjs --task <task-key>`.
4. Read the returned module paths and all declared dependencies.
5. For full audits, resolve `full-audit`.

## Repository layout
- `KERNEL.md`, `AGENTS.md`: short mandatory entrypoints.
- `modules/`: 22 task-focused source-derived policy modules.
- `manifest.json`, `MODULE-INDEX.md`: routing, triggers, dependencies and source references.
- `bundles/`: compact task indexes, not duplicate copies of the policy.
- `tools/resolve-task.mjs`: task-to-module resolver.
- `tools/build-modules.mjs`: deterministic regeneration of modules from preserved source directives.
- `tools/build-bundles.mjs`: compile full task bundles on demand.
- `assurance/`: quick-reference summaries.
- `source/original-directives/`: preserved original documents.
- `source/traceability-matrix.csv`: source-to-module coverage.
- `adapters/`: short Gemini, Claude and ChatGPT entrypoints.
- `templates/`: audit and remediation templates.

## Release policy
P0 and P1 findings block production release. No agent may waive, downgrade or silently accept either. Risk acceptance applies only to P2/P3. Unknown is not pass.

The 13-Layer Security Assurance Model is an internal framework, not an external certification or claim of compliance.

## Validate
Requires Node.js 20 or later, no third-party packages:
```sh
node tools/build-modules.mjs
git diff --exit-code -- modules/
node tools/build-bundles.mjs
node tools/validate.mjs
node --test tests/*.test.mjs
```

USS is an engineering policy and verification framework. It does not itself prove that an application is secure, compliant, penetration-tested or production-ready. Verify controls against the actual system and retain evidence.
