# Laravel 11 and PHP reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** Laravel 11.x services running on PHP 8.2+  
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
- Verify webhook timestamp headers against the server clock with a tolerance window (e.g. 300 seconds) to prevent replay attacks.
- Enforce atomic idempotency using database transaction locks or unique constraints on payment event IDs (`event_id`).
- Under PCI DSS, prohibit storing Card Verification Values (CVV/CVC) or full card numbers after transaction authorization. Rely exclusively on payment gateway tokenization.
- Redact payment tokens, authentication headers, passwords, and sensitive customer data from Monolog log contexts.

## Runtime, dependencies and verification

- Run PHP processes as a dedicated non-root system user with least filesystem privileges.
- Inject environment variables securely at container or host level; never commit `.env` files to source repositories.
- Use opcache and route/config caching (`php artisan config:cache`, `php artisan route:cache`) in production.
- Automated tests must cover: multi-tenant query boundaries, policy authorization checks, CSRF enforcement, mass assignment rejections, and webhook signature verification failures.
