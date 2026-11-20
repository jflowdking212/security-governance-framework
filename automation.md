# Multi-Agent Engineering Collaboration Protocol

**Authority:** Project Owner (Jude O. Richard / Jay Bliss Tech Limited)  
**Scope:** Universal Security Standard (USS) repository and associated engineering assignments  
**Participating Roles:**
- **Implementation Engineer:** Gemini (A2-02 workflow security and A2-07 scanner assurance)
- **Bounded Implementation Engineer / Independent Auditor:** Claude (A2-06 evidence validation, A2-11 stack profiles and A2-12 browser standards; independent audits only outside its own implementation scope)
- **Supervisory Engineer:** ChatGPT (A2-03 checksum tooling, A2-09 checksum documentation, A2-04 release-status documentation, A2-10 collaboration protocol, and cross-agent review)
- **Project Owner / Final Authority:** Jude O. Richard (cryptographic signing, policy exceptions, and release authorization)

---

## 1. Mandatory Working Protocol

Every engineering agent (Gemini, Claude, ChatGPT, or future automated contributors) must strictly adhere to the following protocol:

1. **Read Entrypoints First:** Always read `automation.md`, `AGENTS.md`, and `KERNEL.md` before performing any analysis or code modifications.
2. **Synchronise with GitHub:** Always authenticate and fetch the latest remote references from GitHub before touching code. GitHub is the single authoritative source of truth.
3. **Never Trust Stale Local Workspaces:** Never assume a previous local checkout or directory reflects current state. Create fresh isolated worktrees or verify exact commit SHAs against GitHub remote heads.
4. **Reproduce Before Fixing:** Inspect, reproduce, and understand reported defects using targeted commands and test fixtures before writing code.
5. **Implement, Do Not Merely Report:** When authorized, implement confirmed technical corrections directly rather than issuing advisory recommendations.
6. **Verify After Every Fix:** Run the affected test suites and validation scripts immediately after applying each correction.
7. **Fix Within Scope:** Address minor, fully understood defects that fall within the authorized scope; surface out-of-scope architectural decisions to the supervisory reviewer and owner.
8. **Record findings without concurrent ledger edits:** Every agent must record discovered defects, severity, reproduction steps and evidence in its own handover. During active parallel work, only ChatGPT updates the shared `coordination/agent-handoff.md` ledger. Other agents submit their findings and exact evidence to ChatGPT for inclusion, preventing concurrent overwrites.
9. **Document Commit and Test Evidence:** Every correction must cite the exact files changed, commit reference, and executed test evidence.
10. **Deliver Precise Handovers:** Provide the next agent with an explicit handover detailing the base commit SHA, branch name, completed fixes, passing test counts, and outstanding owner decisions.
11. **Owner Approval for Releases and Policies:** Never merge into `main`, publish release tags, alter production security rules, or modify licensing without explicit human owner authorization.
12. **Never Falsely Mark Completion:** Never mark an item as passed, verified, or completed without executed command or test evidence. Unknown controls must remain `UNKNOWN` or `NOT VERIFIED`.

---

## 2. Agent Operational Boundaries

- **Gemini (A2-02 / A2-07 implementation):**
  - Works only on the workflow-security AST/schema validator, its adversarial tests, scanner configuration, scan coverage and provenance evidence assigned in Section 2B and the current handoff.
  - Fetches and verifies the live GitHub source SHA before every work session.
  - Runs targeted tests, full validation and hosted CI where authorised.
  - Returns a patch or opens a PR only under its own authenticated identity if it has write access. If not, it preserves the patch and reports the exact access blocker.

- **Claude (A2-06 / A2-11 / A2-12 implementation and independent audit):**
  - Implements only its explicitly assigned evidence-validator, stack-profile and browser-standards corrections.
  - Fetches and verifies the live GitHub source SHA before every work session.
  - Uses adversarial tests and primary standards/browser sources, and reports source dates and exact evidence.
  - Remains read-only when performing an independent audit; it must not certify its own implementation work.

- **ChatGPT (A2-03 / A2-09 / A2-04 / A2-10 supervisory engineering):**
  - Implements and verifies its assigned checksum, checksum-documentation, README/release-status and collaboration-protocol work.
  - Independently inspects actual agent diffs, tests, CI logs and repository state rather than accepting handover claims alone.
  - Prepares the next bounded instruction after each agent handback, fixes safe in-scope defects, and maintains the shared coordination ledger.

- **Project Owner (Authority & Cryptographic Root):**
  - Retains personal custody of private SSH signing keys on local hardware.
  - Performs final release signing ceremonies (`SHA256SUMS.sig`, signed release tags).
  - Approves production releases, repository settings, and licensing policies.

---


## 2A. Read-only audit and commit provenance boundaries

- The independent auditor's default assignment is read-only. Claude must inspect, reproduce, test in isolated scratch copies, and report findings without modifying the audited branch, unless the owner explicitly changes the assignment.
- The implementation rule "Implement, do not merely report" applies only to an agent that has been explicitly assigned and authorised to implement. It does not override a read-only audit assignment.
- Implementation agents must commit using their own distinct, authenticated GitHub identity. Never set an agent commit's author name or email to the project owner's identity merely because the owner's credentials are available.
- Do not use the owner's private release-signing key for agent commits. The owner's release key is reserved for the final release ceremony.
- If no distinct agent identity has write permission to the repository, preserve the work locally, report the exact access blocker, and request that the owner provision or authorise an agent identity. Do not spoof author metadata or silently push agent work as the owner.
- A commit made by the owner through the owner's authenticated account must be clearly identified in the handoff as an owner-issued change, not an implementation-agent commit.


## 2B. Active parallel remediation allocation

For the USS v1.0.0-rc.1 second-audit remediation, work is divided by engineering strength and file ownership. The current authoritative assignment and exact finding IDs are recorded in `coordination/agent-handoff.md` Section 9.

- **ChatGPT:** owns checksum tooling and tests (A2-03), checksum threat-model/consumer documentation (A2-09), release-status documentation (A2-04), and collaboration-protocol clarification (A2-10). It also performs supervisory diff review of Gemini and Claude deliverables.
- **Gemini:** owns workflow-security AST validation and mutation tests (A2-02), plus CI/scanner configuration and provenance evidence (A2-07). It must not modify checksum or evidence-validator files.
- **Claude:** is explicitly authorised to implement evidence-validator hardening (A2-06), review/correct all eight reference stack profiles (A2-11), and verify/update PNA / Local Network Access terminology (A2-12). It must not modify workflow or checksum files.

The independent-auditor read-only default in Section 2A is overridden only for the specifically assigned Claude implementation tasks above. Claude cannot independently approve or certify its own A2-06, A2-11 or A2-12 changes. ChatGPT must inspect the diffs and test evidence, and a separate independent review is required for final assurance of Claude-authored changes.

Agents must not edit files owned by another workstream. Only ChatGPT updates the shared `coordination/agent-handoff.md` ledger while these parallel assignments are active. Each agent must return exact changed paths, base and result SHAs, executed commands, test output, limitations and rollback considerations.

The connected `jayblisstech-bot` account currently has read-only access to this repository. No agent may push using the owner's identity or spoof author metadata. Until a distinct authenticated write-enabled identity is provisioned, Gemini and Claude must prepare patches in their authorised workspaces and return them for owner-authorised integration. Owner-issued integration commits must be explicitly identified as such.

## 3. Governance Policy Limitation

> **Note on Scope:** This protocol governs multi-agent collaboration within the Universal Security Standard repository (`security-governance-framework`). A comprehensive organisation-wide automation policy will eventually be deployed from a central organization repository under JayBlissTech. Until formal organization-level deployment is authorized by the owner, this USS-specific policy serves as the binding operational protocol.
