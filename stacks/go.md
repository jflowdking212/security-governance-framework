# Go reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** Backend services using supported Go releases (1.25-1.27 as of 2026-11-20), with `net/http`, Gin, Echo or Chi  
**Related modules:** M01, M02, M04, M05, M08, M09, M10, M12, M21  
**Companion supplements:** Cryptography and key management; API protocol security; container and cloud runtime  

This profile defines security standards for services built with Go, addressing HTTP server timeouts, concurrency safety, cryptographic comparisons, memory safety, and dependency hygiene.

## HTTP server hardening and timeout controls

- Configure explicit read, write, idle, and header timeouts on every `http.Server` instance. Prohibit using the default `http.ListenAndServe()` with zero timeouts, which exposes services to slowloris and resource exhaustion attacks.
- On all outbound `http.Client` requests, enforce explicit timeouts (`Timeout: 10 * time.Second`) or pass request contexts with timeouts (`context.WithTimeout`). Never use the zero-value `http.DefaultClient`.
- Limit incoming request bodies using `http.MaxBytesReader` to prevent memory exhaustion from oversized payload uploads.
- Secure HTTP headers: enforce `HSTS`, `X-Content-Type-Options: nosniff`, and appropriate CORS boundaries on API handlers.

## Cryptography and timing safety

- Use `crypto/subtle.ConstantTimeCompare` for equal-length MACs, fixed-format signatures and secret tokens; validate expected lengths before comparison. Do not compare password hashes directly: use a password-hashing library's verification function (for example, bcrypt or Argon2id). Never use ordinary `==` for MAC/signature/token verification.
- Enforce modern TLS standards: configure `tls.Config{MinVersion: tls.VersionTLS12}` (or `tls.VersionTLS13`) and secure cipher suites on public-facing listeners.
- Use `crypto/rand` for cryptographic randomness and token generation. Prohibit using `math/rand` for security-sensitive values.
- Redact secrets, authorization tokens, and private keys from structured logging (`slog`, `zap`, `zerolog`).

## Concurrency, race detection and memory safety

- Compile and run test suites with `-race` (`go test -race ./...`) in CI to detect data races before deployment.
- Avoid shared mutable state across goroutines; prefer message passing via channels or protect concurrent access with `sync.Mutex` or `sync.RWMutex`.
- Limit goroutine lifetimes: always bind background worker goroutines to cancellable contexts (`context.WithCancel`) to prevent goroutine leaks.
- Avoid `unsafe` package usage unless strictly necessary for low-level systems interop, and document all unsafe blocks with security justifications.

## Dependency verification and supply chain

- Commit `go.mod` and `go.sum` to version control. Build with `-mod=readonly` in CI to reject unauthorized dependency drift.
- Run `govulncheck` in CI to identify known vulnerabilities in dependencies and Go standard library packages.
- Minimise CGO dependencies (`CGO_ENABLED=0`) where possible to produce statically linked, self-contained binaries with reduced attack surface.


## Input, identity and outbound-request boundaries

- Authenticate requests before resolving tenant-owned resources; enforce object-level authorization after lookup and before mutation. Never trust tenant IDs or roles supplied only in request JSON, headers or query parameters.
- Decode JSON with body-size limits, explicit schema validation and checks for trailing or unexpected input. Avoid silently accepting unknown fields on security-sensitive command DTOs.
- Treat user-controlled outbound URLs as SSRF input. Use destination allowlists, validate resolved IPs and redirect targets, and block loopback, private, link-local and metadata destinations unless explicitly required.
- Configure outbound clients with explicit total and connection timeouts, bounded redirects and request contexts. Do not reuse the zero-timeout default client for untrusted destinations.

## Required application tests

- HTTP slow-client, oversized-body, header-size, timeout and connection-limit tests.
- Cross-tenant object-ID substitution and authorization tests.
- JSON unknown-field, trailing-data and oversized-payload tests.
- SSRF tests for private/loopback/link-local/metadata IPs, DNS rebinding and redirect chains.
- MAC/signature length mismatch and invalid-signature tests; password verification must use the selected password-hashing library.
- Run `go test -race ./...`, fuzz security-sensitive parsers and run `govulncheck` on the exact module graph.

## Verification record required before marking this profile validated

Record the consuming repository and exact commit, `go version`, `go.mod`/toolchain version, framework and dependency versions, CGO and build flags, container/runtime assumptions, TLS and proxy settings, test/fuzz/race commands and results, vulnerability scan output and independent reviewer identity. Go's official policy supports a release until two newer major releases exist; as of this review, 1.25-1.27 are the supported release lines. Re-check the official release history before adoption.

## Primary references

- [Go release history and support policy](https://go.dev/doc/devel/release)
- [Go 1.27 release notes](https://go.dev/doc/go1.27)
- [Go standard library HTTP package](https://pkg.go.dev/net/http)
- [Go vulnerability management](https://go.dev/doc/security/vuln/)
