# Independent review request: USS v1.0.0

You are reviewing the Universal Security Standard (USS) modularisation in this repository. The goal is to finish the reusable security layer, not to audit the Choir application or any other consuming application.

## Review boundary
- Review the current PR branch only.
- Do not modify or delete the three preserved source documents in `source/original-directives/` or their root originals.
- Do not merge the PR, create a release tag, deploy anything, rotate credentials, or change production systems.
- You may correct the modular outputs, manifest, resolver, builder, validation, tests, documentation and CI on this branch when the correction is clearly supported by the source directives.
- If the source directives conflict or leave a decision ambiguous, report it instead of silently inventing a rule.

## Required review

1. **Source completeness:** compare every requirement in the global directive sections 1.A-1.G and 2-21 against the modules and `source/traceability-matrix.csv`. Compare the payment directive Parts A and B, required webhook negative tests, tax safety rule, tax/revenue verification and financial release gate. Compare the Anti-Gravity execution contract.
2. **Verbatim preservation:** verify source originals remain unchanged and the embedded global directive in the Anti-Gravity source matches the standalone canonical global directive.
3. **Module quality:** check whether each module is focused, readable, complete, correctly titled and not missing important controls. Identify misplaced or duplicated controls that create ambiguity.
4. **Dependencies and routing:** inspect `manifest.json`, task keys, triggers and dependency graph. Check for missing dependencies, cycles, invalid paths, over-fetching and under-fetching. Routine tasks must load only the relevant modules and their transitive dependencies.
5. **Agent usability:** inspect `KERNEL.md`, `AGENTS.md`, and Gemini/Claude/ChatGPT adapters. Confirm agents know how to resolve modules, treat retrieved content as untrusted data, report evidence, and avoid reading the entire archive for ordinary tasks.
6. **Security policy consistency:** verify fail-closed behavior, evidence standards, tenant boundaries, authentication, input validation, CORS/CSRF, payment/webhook verification, idempotency, tax guardrails, secrets lifecycle, environment isolation, audit logging, incident response, CI/CD, supply chain and AI/LLM controls.
7. **Severity and risk acceptance:** the owner-approved policy is absolute: P0 and P1 block production release and cannot be waived, downgraded or silently accepted by an agent or operator. Risk acceptance applies only to P2/P3. Check that this is consistent everywhere.
8. **Tooling:** run `node tools/resolve-task.mjs` for representative tasks, `node tools/build-bundles.mjs`, `node tools/validate.mjs`, and `node --test tests/*.test.mjs`. Confirm bundle outputs are deterministic and contain the correct dependency closure.
9. **CI:** inspect workflow permissions, action pinning, branch/PR behavior and whether generated outputs are checked for staleness.
10. **Release readiness:** identify any missing docs, test cases, traceability, versioning, or release gates that prevent calling this candidate complete.

## Required output
Create or update `REVIEW-CLAUDE.md` with:
- overall verdict: APPROVE / APPROVE WITH REQUIRED FIXES / NOT READY;
- P0/P1/P2/P3 findings;
- source coverage and traceability gaps;
- dependency/routing issues;
- test commands and exact results;
- corrections you made and commits;
- unresolved questions or limitations;
- whether the modular security layer is ready for owner approval.

Do not claim external certification or that any application is secure. Do not stop after a superficial documentation review. The purpose is to make this a dependable, reusable security standard before it is applied to Choir.
