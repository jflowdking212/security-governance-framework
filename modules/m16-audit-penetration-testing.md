# M16 Audit, remediation and authorised penetration testing

**Source sections:** GLOBAL:5, GLOBAL:6  
**Generated from:** preserved canonical directives. Do not edit extracted requirements independently; update the source and rebuild.

---

**## 5. Audit → Remediate → Penetration Test → Re-Audit Lifecycle**



Do not begin security assurance by pretending an AI code review is a full penetration test.



Use the following lifecycle:



1. **\*\*Production Security Audit\*\*** — assess the 13 layers; identify P0/P1/P2/P3 or equivalent severity; document evidence and unknowns.

2. **\*\*Remediation\*\*** — fix confirmed defects; add regression tests; add missing controls; document architecture/security decisions.

3. **\*\*Internal Re-Verification\*\*** — re-run deterministic tests, security scans, authorization tests, dependency checks, CI gates, and applicable DAST against a safe environment.

4. **\*\*Authorized External Penetration Test\*\*** — use a qualified independent tester/team against explicitly authorized scope; never represent an internal AI audit as independent external validation.

5. **\*\*Pen-Test Remediation\*\*** — fix validated findings; add regression coverage; preserve evidence of disposition.

6. **\*\*Re-Audit\*\*** — repeat the 13-layer audit; verify remediation held; record remaining limitations.

7. **\*\*Security Assurance Package\*\*** — preserve auditable security evidence for procurement, due diligence, and enterprise security questionnaires.



---

**## 6. Authorized Penetration Testing Boundary**



Penetration-testing activity must be restricted to systems the user owns or is explicitly authorized to assess.



Before intrusive or exploitative testing against a live target:



- verify target scope;

- verify authorization;

- prefer staging or dedicated test environments;

- define excluded systems;

- protect production data;

- establish rollback/recovery;

- avoid destructive payloads unless specifically approved;

- preserve logs/evidence;

- stop if the test creates unexpected production risk.



Defensive code review, static analysis, local tests, mocked exploit regression tests, and analysis of user-provided authorized systems may proceed as part of normal engineering work.



---
