# Flutter and Dart mobile reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** Flutter stable 3.x and Dart 3.x applications for iOS and Android; Flutter 3.50.0 is the stable release listed on 2026-11-20  
**Related modules:** M01, M02, M04, M05, M08, M09, M12  
**Companion supplements:** Authentication and federation; API protocol security; cryptography and key management  

This profile defines security standards for mobile applications built with Flutter and Dart, addressing device storage, network transport, reverse engineering, and mobile platform security.

## Mobile platform configuration and app boundary

- On Android, enforce secure network communication via Android Network Security Configuration (`network_security_config.xml`) with `cleartextTrafficPermitted="false"`. Prohibit cleartext HTTP.
- On iOS, enforce App Transport Security (ATS) in `Info.plist` with `NSAllowsArbitraryLoads = false`.
- Prohibit embedding hardcoded backend API secrets, database credentials, or private cryptographic keys in Dart source code, assets, or platform configuration files.
- Validate incoming deep links, App Links (Android), and Universal Links (iOS) against registered host allowlists to prevent link hijacking and parameter injection.

## Secure local storage and credential management

- Prohibit storing authentication tokens, cryptographic keys, passwords, or personal data in plaintext `SharedPreferences` (Android) or `UserDefaults` (iOS).
- Use platform secure storage backed by Android Keystore and iOS Keychain. Do not assume a plugin is hardware-backed merely because it is named secure storage; inspect the exact plugin version, platform implementation, key accessibility, backup behaviour and whether hardware-backed protection is actually available on the device.
- Enforce cryptographic key access controls, binding sensitive credentials to biometric authentication (Fingerprint, Face ID) or device lock screen credentials where supported.
- Clear cached user credentials, secure storage, and local state immediately upon user logout or account suspension.

## Transport security and API communication

- Enforce TLS 1.3 or 1.2 on all backend API requests using `HttpClient` or Dio.
- Implement SSL/TLS certificate pinning or public key pinning for high-security endpoints to prevent Man-in-the-Middle (MITM) attacks on compromised Wi-Fi networks.
- If certificate/public-key pinning is justified by the threat model, ship backup pins and a tested rotation process. A pin mismatch MUST fail closed; never silently fall back to trusting any certificate.

## UI protection, logging and clipboard security

- Conceal or blur sensitive screens (financial screens, authentication flows, PIN entry) when the application is placed in the background or displayed in the mobile task switcher / recents menu.
- Restrict or disable clipboard copy operations on sensitive data such as passwords, OTPs, and payment numbers.
- Suppress sensitive debugging output: ensure `print()`, `debugPrint()`, and crash-reporting payloads never include passwords, bearer tokens, or cardholder data in release builds.

## Release build hygiene and integrity

- Enable code obfuscation for release builds using Flutter's built-in build flags (`--obfuscate --split-debug-info`).
- Sign Android release artifacts with Google Play App Signing or protected release keystores; sign iOS release builds with valid Apple Developer certificates.
- Maintain pinned dependency versions in `pubspec.lock` and inspect dependencies regularly for known security vulnerabilities.


## WebView, JavaScript bridges and untrusted web content

- Treat every WebView document, iframe, redirect, navigation and message as untrusted unless the exact origin is explicitly allowlisted. Validate scheme, host and port; reject unexpected schemes and navigation to arbitrary external destinations.
- Disable JavaScript when it is not required. If JavaScript is required, do not expose native capabilities to arbitrary content.
- Avoid legacy Android `addJavascriptInterface` bridges for untrusted or remotely navigable content. Android documents that the interface is exposed to every frame and lacks origin-based access control. Prefer origin-restricted message APIs such as AndroidX `addWebMessageListener` with exact allowed-origin rules where supported.
- Validate message origin, frame context, schema, size and operation permissions. Expose the minimum native methods; never make authentication tokens, local files, device identifiers or privileged application actions available to a page simply because it is displayed in a WebView.
- Apply equivalent origin and frame validation to iOS `WKWebView` message handlers. Do not assume an Android bridge design is automatically safe on iOS.

## Android manifest, backup and network controls

- Set `android:exported` explicitly for every activity, service and receiver. Export only components that must be invoked by other applications; protect exported components with the narrowest permissions and validate every incoming Intent and deep link.
- Review `android:allowBackup`, Android 12+ data-extraction/backup rules and device-transfer behaviour. Exclude credentials, refresh tokens, private keys, sensitive databases and cached personal data from backup/restore unless a documented encrypted recovery design requires them.
- Keep `usesCleartextTraffic=false` and use a reviewed Network Security Configuration. Do not ship debug trust anchors or permissive cleartext exceptions in release builds.
- Use Play Integrity as a server-verified risk signal for sensitive operations. Bind the integrity token to the request using a server-verified nonce or `requestHash`, verify package and request details on the backend, and never trust a client-side boolean verdict as authorization.

## iOS Keychain, App Attest and platform controls

- Select Keychain accessibility deliberately. Use a `ThisDeviceOnly` class for credentials that must not migrate to another device; choose `WhenUnlocked` or `AfterFirstUnlock` based on the actual foreground/background requirement. Do not use deprecated always-accessible classes for secrets.
- Use App Attest for high-risk app-integrity signals where supported. The server must verify the attestation/assertion, app identity, challenge, request binding and assertion counter. Handle unsupported devices with an explicit risk policy rather than trusting client-side checks.
- Keep App Transport Security enabled. Any exception must be narrowly scoped, documented and tested; do not enable arbitrary loads globally.

## Push notifications, app links and OAuth

- Treat Firebase Cloud Messaging payloads and notification deep links as untrusted input. Do not place passwords, bearer tokens, payment credentials or sensitive personal data in push payloads. Validate every deep link against an exact route/host allowlist and perform authorization again on the server.
- Treat FCM registration tokens as routing identifiers, not user identity or proof of authorization. Bind, rotate and revoke device tokens on the server when account sessions change.
- Use OAuth 2.0 Authorization Code with PKCE (S256) through the system browser or platform authentication session. Validate `state`, exact redirect URI and OIDC `nonce` where applicable. Do not collect user credentials in an embedded WebView or ship a client secret in the app.

## Release build and integrity limitations

- Flutter obfuscation and split debug information make reverse engineering harder but do not encrypt assets, hide embedded secrets or replace server-side authorization. Keep symbol files private and versioned for crash analysis.
- Protect Android signing keys and Apple distribution credentials outside the repository and CI logs. Verify release entitlements, manifest, network configuration and signing identity from the actual built artifact.
- Pinning, Play Integrity and App Attest are defence-in-depth signals; none replaces backend authentication, authorization, replay protection or abuse monitoring.

## Required application tests

- WebView navigation allowlist, malicious redirect, iframe/native-bridge origin spoofing and message-schema tests.
- Deep-link and notification payload tampering, FCM token reassignment and revoked-session tests.
- Android exported-component and backup/restore tests, including Android 12+ data-extraction rules.
- iOS Keychain accessibility, backup migration, App Attest challenge/replay and unsupported-device handling tests.
- OAuth PKCE, state, nonce, redirect URI and embedded-WebView rejection tests.
- TLS downgrade, certificate-pin mismatch and pin-rotation tests; confirm there is no trust-any fallback.
- Release artifact inspection for debug flags, embedded secrets, signing identity and platform entitlements.

## Primary platform references

- [Flutter stable release notes](https://docs.flutter.dev/release/release-notes)
- [Flutter Android release builds and obfuscation](https://docs.flutter.dev/deployment/android)
- [Android WebView native bridge security](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges)
- [Android origin-restricted WebView message listeners](https://developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge)
- [Android exported activity behaviour](https://developer.android.com/guide/topics/manifest/activity-element)
- [Android Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)
- [Google Play Integrity request binding](https://developer.android.com/google/play/integrity/standard)
- [Firebase Cloud Messaging for Flutter](https://firebase.google.com/docs/cloud-messaging/flutter/get-started)
- [Apple Keychain accessibility](https://developer.apple.com/documentation/security/restricting-keychain-item-accessibility)
- [Apple App Attest server verification](https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server)
- [OAuth 2.0 Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636)


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