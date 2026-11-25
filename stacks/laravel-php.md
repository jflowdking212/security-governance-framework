# Laravel and PHP reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** Laravel 12.x (PHP 8.2-8.5) and Laravel 13.x (PHP 8.3-8.5); Laravel 11 is end-of-security-support  
**Related modules:** M01, M02, M03, M04, M05, M06, M07, M08, M09, M10, M12, M21  
**Companion supplements:** Authentication and federation; SSRF and outbound requests; API protocol security; cryptography and key management; container and cloud runtime  

This profile provides framework-specific security guidance for Laravel applications. It is a review checklist and baseline specification, not a claim that Laravel is secure by default without application-level controls.

## Application boundary and framework configuration

- Keep PHP and Laravel versions actively supported by their maintainers with security patches. Commit `composer.lock` and run `composer audit` in CI.
- Ensure `APP_DEBUG=false` in all production and staging environments. Never expose debug stack traces, environment variables, or database schema errors to client responses.
- Set `APP_ENV=production` and ensure `APP_KEY` is generated via `php artisan key:generate` and protected as a secret.
- Configure `TrustProxies` middleware explicitly with known reverse proxy IP ranges or headers. Never trust `*` unless running behind an authenticated private ingress that strips spoofed `X-Forwarded-*` headers.
- Configure CORS in `config/cors.php` with explicit allowed origins. Prohibit wildcard `*` origins combined with `supports_credentials: true`.
- Enforce strict security headers (Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options) via middleware.

## Authentication, sessions and tenant isolation

- When using session cookies, configure `config/session.php` with `secure => true`, `http_only => true`, `same_site => 'lax'` (or `'strict'`), and `encrypt => true`.
- For API authentication (Sanctum or Passport), store hashed personal access tokens in the database, enforce token expiration, and validate token abilities on every route.
- Implement CSRF protection for all cookie-authenticated mutations via Laravel's `ValidateCsrfToken` middleware.
- Enforce multi-tenant isolation authoritatively at the database query layer:
  - Apply global Eloquent model query scopes (e.g. `TenantScope`) enforcing `tenant_id` filtering on all tenant-owned models.
  - Never allow tenant identifiers, user IDs, or role assignments to be updated via mass assignment.
- Define explicit Laravel Policies and Gates (`Gate::define`) for every model and resource mutation. Authorize every request using `$this->authorize()` or middleware before executing business logic.
- Require re-authentication (`password.confirm`) before sensitive profile, password, or financial changes.

## Input validation, Eloquent and API security

- Use dedicated `FormRequest` classes with strict validation rules for all incoming endpoints. Never use `$request->all()` directly in database queries.
- Protect Eloquent models against mass assignment by explicitly defining `$fillable` allowlists. Prohibit unconstrained `$guarded = []`.
- Use parameterized queries and Eloquent query builder bindings. Prohibit raw SQL string concatenation with user input; avoid unvalidated `DB::raw()` calls.
- Apply granular rate limiting using Laravel's `RateLimiter` facade on authentication routes, password resets, webhook receivers, and resource-heavy APIs.
- Validate file uploads strictly by MIME type, extension, and byte size. Store uploaded files outside the public document root and use private storage disks with signed URLs for access.

## Webhooks, payments and timing-safe operations

- Verify webhook signatures using timing-safe comparison (`hash_equals()`) over the raw request payload (`$request->getContent()`).
- When the provider supplies a timestamp that is covered by its signature, validate it against the server clock using the provider's documented tolerance to reduce replay risk. Do not invent or require a separate timestamp header when the provider does not sign or supply one; use the provider's documented freshness mechanism and durable idempotency controls instead.
- Enforce atomic idempotency using database transaction locks or unique constraints on payment event IDs (`event_id`).
- Under PCI DSS, prohibit storing Card Verification Values (CVV/CVC) or full card numbers after transaction authorization. Rely exclusively on payment gateway tokenization.
- Redact payment tokens, authentication headers, passwords, and sensitive customer data from Monolog log contexts.

## Runtime, dependencies and verification

- Run PHP processes as a dedicated non-root system user with least filesystem privileges.
- Inject environment variables securely at container or host level; never commit `.env` files to source repositories.
- Use opcache and route/config caching (`php artisan config:cache`, `php artisan route:cache`) in production.
- Automated tests must cover: multi-tenant query boundaries, policy authorization checks, CSRF enforcement, mass assignment rejections, and webhook signature verification failures.


## Version support and lifecycle

As of 2026-11-20, Laravel 11 security support ended on 2026-03-12 and it MUST NOT be selected for new production deployments. Laravel 12 bug-fix support ended on 2026-08-13 and security fixes continue through 2027-02-24. Laravel 13 supports PHP 8.3-8.5 and security fixes through 2028-03-17. Prefer Laravel 13 for new deployments; existing Laravel 12 deployments need a planned upgrade before their security-fix window ends. Re-check the official release table at each consuming-application review.

## Blade, Livewire and Inertia output boundaries

- Use Blade's escaped `{{ ... }}` output for untrusted values. Raw `{!! ... !!}` output is permitted only for content that has been sanitized with a context-appropriate allowlist; never render user-controlled HTML directly.
- When placing server data into JavaScript, use Laravel's safe serialization helpers such as `Js::from()`; do not manually interpolate untrusted strings into inline script blocks.
- Treat Livewire public properties and every action parameter as attacker-controlled request input. Validate and authorize each action immediately before the state change. A locked property can prevent client mutation of that property but does not replace authorization.
- Inertia page props are client-visible. Do not include secrets, internal-only model fields, or data the current user is not authorized to see. Re-check authorization on every server-side action and endpoint; client-side component visibility is not an access control.

## Queue, Horizon and asynchronous execution

- Assume queued jobs can be retried, duplicated, delayed or processed after the originating user's permissions change. Make business effects idempotent with database constraints or durable idempotency keys; do not rely on an in-memory check.
- Dispatch jobs after database transactions commit when the job depends on committed records (for example, use Laravel's `afterCommit()` dispatch option). Use Laravel's `ShouldBeUnique` jobs or overlap middleware as concurrency controls, but retain database-level correctness constraints.
- Pass minimal identifiers rather than serializing unnecessary sensitive model state. Reload the record in the job and re-check tenant ownership and authorization before performing privileged work.
- Set explicit tries, backoff, timeout and failure handling for each job class. Protect failed-job storage and queue dashboards.
- Horizon's dashboard and any queue-management endpoint MUST be protected by an explicit authorization gate and network restrictions. Never assume a dashboard is private merely because it is intended for operators.

## Telescope, Debugbar and operational data

- Disable Debugbar and development-only debugging interfaces in production.
- Telescope MUST be disabled or protected by an explicit least-privilege authorization gate in non-local environments. Review enabled watchers and redact request headers, cookies, bearer tokens, passwords, payment data and sensitive request/response bodies.
- Apply retention and pruning to telemetry. Treat Telescope, Horizon and failed-job dashboards as privileged production interfaces, not harmless observability pages.

## Signed URLs and outbound HTTP / SSRF

- A signed URL protects the signed path and query string from modification; it does not authenticate the caller or sign an arbitrary request body. For signed routes, read signed values from the query string and do not let body parameters override them. Add authentication and authorization where the operation is sensitive.
- Treat user-supplied URLs passed to Laravel's HTTP client as SSRF input. Prefer a fixed destination allowlist; resolve and validate every destination; block loopback, private, link-local and cloud-metadata ranges unless explicitly required; revalidate redirects or disable redirects; set connect and total timeouts.
- Do not treat a successful URL signature, an allowlisted hostname or a successful DNS lookup as proof that the final network destination is safe. Defend against DNS rebinding and redirects to prohibited address spaces.

## Additional required application tests

- Blade reflected and stored XSS tests, including any raw HTML rendering and JavaScript-context serialization.
- Livewire forged action parameters, mutated public properties, cross-tenant object IDs and authorization failures.
- Inertia props do not expose secrets or cross-tenant data.
- Duplicate/retried queue jobs do not duplicate financial or privileged state changes; jobs dispatched inside rolled-back transactions do not execute.
- Horizon, Telescope and Debugbar are inaccessible to unauthorised production users; telemetry redaction is verified.
- Signed URL body-parameter override, expiry and authorization tests.
- SSRF tests for private/loopback/link-local/metadata targets, DNS rebinding, redirects and unexpected schemes.

## Primary framework references

- [Laravel release notes and support policy](https://laravel.com/framework/docs/13.x/releases)
- [Laravel Blade templates](https://laravel.com/framework/docs/13.x/blade)
- [Laravel queues](https://laravel.com/framework/docs/13.x/queues)
- [Laravel Horizon dashboard authorization](https://laravel.com/framework/docs/horizon)
- [Laravel Telescope dashboard authorization and data retention](https://laravel.com/framework/docs/telescope)
- [Laravel hashing](https://laravel.com/framework/docs/13.x/hashing)
- [Laravel signed URL generation and validation](https://laravel.com/framework/docs/urls)
- [Laravel HTTP client](https://laravel.com/framework/docs/13.x/http-client)
- [Livewire security](https://livewire.laravel.com/docs/4.x/security)


## Verification record required before marking this profile validated

Keep this profile marked REFERENCE ONLY until a named consuming application has been assessed. Record all of the following in the consuming application's evidence report:

- Repository URL and exact full 40-character commit SHA.
- Exact runtime, framework, compiler/SDK, package-manager and dependency versions; include lockfile digest.
- Deployment topology, operating system, container/base image, reverse proxy, ingress, TLS termination and relevant network boundaries.
- Security-relevant framework settings, environment flags, middleware, plugins and platform configuration actually deployed.
- Exact validation commands, negative security tests, results, CI run identifiers, scanner reports and build-artifact references.
- Known gaps, accepted risks, expiry dates and compensating controls, if any.
- Assessor and independent approver names plus stable issuer-scoped identities; record the assessment date and independent review result.

Documentation review alone, a passing unit-test suite, or a generic sample application does not validate a consuming application's profile.