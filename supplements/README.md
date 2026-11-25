# USS implementation supplements

**Status:** Supplemental engineering guidance, not canonical source-derived policy  
**Reviewed:** 2026-11-18  
**Compatibility:** Framework, provider and regulatory details must be checked against the versions and jurisdictions actually used by a project.

The universal modules state the controls that apply across systems. These supplements add practical implementation guidance for technologies and security boundaries that need more detail than the preserved source directives provide.

## How to use supplements

1. Resolve the task and read every required universal module and dependency first.
2. Read the relevant supplement when the application uses the technology or boundary it covers.
3. Treat the supplement as additional guidance. It never weakens, replaces or overrides KERNEL.md, the canonical modules, or a stricter project profile.
4. Record the exact framework/library/provider version and the authoritative guidance checked during implementation.
5. Do not claim a supplement has been implemented merely because an agent read it. Verify the application and record test evidence.

Supplements can be resolved automatically using `node tools/resolve-task.mjs --supplement <id|slug|path>` or via matching task keys and keywords. Agents must state which supplements were used in their completion report.

## Security supplements

| Supplement | Use when | Related modules |
|---|---|---|
| [Authentication and federation](authentication-federation.md) | OAuth 2.0, OpenID Connect, JWT, refresh tokens, passkeys or MFA are implemented | M02, M03, M08 |
| [SSRF and outbound requests](ssrf-outbound-requests.md) | The application fetches user-controlled URLs, webhooks, images, documents, previews or remote resources | M04, M05, M08, M10 |
| [API protocol security](api-graphql-websocket-grpc.md) | GraphQL, WebSocket or gRPC endpoints are used | M03, M04, M05, M10 |
| [Cryptography and key management](cryptography-key-management.md) | Data encryption, signing keys, key rotation, envelope encryption or cryptographic storage is designed | M08, M09, M12 |
| [Data lifecycle and privacy](data-lifecycle-privacy.md) | Personal, sensitive or regulated data is collected, processed, shared, retained or deleted | M09, M10, M11 |
| [Container and cloud runtime](container-cloud-runtime.md) | Docker, Kubernetes, cloud workload identity, IAM or container deployment is used | M08, M10, M12 |
| [AI agent, tool and retrieval security](ai-agent-security.md) | LLM tools, coding agents, MCP, browser/computer-use agents, RAG, memory or autonomous actions are used | M03, M04, M08, M09, M10, M11, M12, M22 |

## Stack reference profiles

The profiles under ../stacks are implementation checklists, not proof that a consuming application is secure. They remain unverified until tested against a named application, exact dependency versions, runtime configuration and deployment environment.

- [Node.js and Express reference profile](../stacks/nodejs-express.md)
- [Python and FastAPI reference profile](../stacks/python-fastapi.md)

## Authority and change control

These documents are supplemental engineering guidance informed by the linked standards and project experience. They are not verbatim extracts from the preserved global, payment or Anti-Gravity source documents. Changes to them must be reviewed for technical accuracy, current version compatibility, security impact and consistency with universal USS policy.

If an official standard, framework or provider document changes, update the supplement only after reviewing the current primary source. If sources conflict or applicability is uncertain, record the uncertainty and escalate it rather than inventing a universal rule.
