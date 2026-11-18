# USS authentication task index

**Version:** 1.0.0  
**Purpose:** This file is a compact routing index, not a substitute for the modules listed below.

Read `KERNEL.md` first. Then read every module below in the listed dependency order. Do not load unrelated modules. For a task crossing another security boundary, resolve the additional task/module and its dependencies.

## Required module order

| Order | Module | Source sections | File |
|---:|---|---|---|
| 1 | M01 Core operating policy and secure engineering | GLOBAL:Core; GLOBAL:13; GLOBAL:14 | `modules/m01-engineering-workflow.md` |
| 2 | M08 Secrets, credentials and lifecycle management | GLOBAL:1.F; GLOBAL:17 | `modules/m08-secrets.md` |
| 3 | M02 Authentication, identity and sessions | GLOBAL:1.B authentication | `modules/m02-authentication-sessions.md` |

**Direct task modules:** M02  
**Resolved modules including dependencies:** M01, M08, M02

To compile the full text bundle locally, run:

```sh
node tools/build-bundles.mjs --task authentication
```

Generated output is written to `dist/bundles/authentication.md`.
