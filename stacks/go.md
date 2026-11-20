# Go reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** Backend services and microservices using Go 1.22+ (`net/http`, Gin, Echo, Chi)  
**Related modules:** M01, M02, M04, M05, M08, M09, M10, M12, M21  
**Companion supplements:** Cryptography and key management; API protocol security; container and cloud runtime  

This profile defines security standards for services built with Go, addressing HTTP server timeouts, concurrency safety, cryptographic comparisons, memory safety, and dependency hygiene.

## HTTP server hardening and timeout controls

- Configure explicit read, write, idle, and header timeouts on every `http.Server` instance. Prohibit using the default `http.ListenAndServe()` with zero timeouts, which exposes services to slowloris and resource exhaustion attacks.
- On all outbound `http.Client` requests, enforce explicit timeouts (`Timeout: 10 * time.Second`) or pass request contexts with timeouts (`context.WithTimeout`). Never use the zero-value `http.DefaultClient`.
- Limit incoming request bodies using `http.MaxBytesReader` to prevent memory exhaustion from oversized payload uploads.
- Secure HTTP headers: enforce `HSTS`, `X-Content-Type-Options: nosniff`, and appropriate CORS boundaries on API handlers.

## Cryptography and timing safety

- Use `crypto/subtle.ConstantTimeCompare` for all secret comparisons (HMAC signatures, webhook tokens, API keys, password hashes). Never use `==` on cryptographic or secret values.
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
