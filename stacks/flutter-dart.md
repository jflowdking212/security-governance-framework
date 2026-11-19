# Flutter and Dart mobile reference profile

**Profile status:** REFERENCE ONLY - NOT VERIFIED AGAINST A CONSUMING APPLICATION  
**Framework scope:** Mobile client applications using Flutter 3.x and Dart 3.x for iOS and Android  
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
- Use hardware-backed secure storage solutions (such as `flutter_secure_storage` backed by the Android Keystore / EncryptedSharedPreferences and iOS Keychain).
- Enforce cryptographic key access controls, binding sensitive credentials to biometric authentication (Fingerprint, Face ID) or device lock screen credentials where supported.
- Clear cached user credentials, secure storage, and local state immediately upon user logout or account suspension.

## Transport security and API communication

- Enforce TLS 1.3 or 1.2 on all backend API requests using `HttpClient` or Dio.
- Implement SSL/TLS certificate pinning or public key pinning for high-security endpoints to prevent Man-in-the-Middle (MITM) attacks on compromised Wi-Fi networks.
- Handle certificate expiration and renewal with fallbacks that avoid locking users out of the application.

## UI protection, logging and clipboard security

- Conceal or blur sensitive screens (financial screens, authentication flows, PIN entry) when the application is placed in the background or displayed in the mobile task switcher / recents menu.
- Restrict or disable clipboard copy operations on sensitive data such as passwords, OTPs, and payment numbers.
- Suppress sensitive debugging output: ensure `print()`, `debugPrint()`, and crash-reporting payloads never include passwords, bearer tokens, or cardholder data in release builds.

## Release build hygiene and integrity

- Enable code obfuscation for release builds using Flutter's built-in build flags (`--obfuscate --split-debug-info`).
- Sign Android release artifacts with Google Play App Signing or protected release keystores; sign iOS release builds with valid Apple Developer certificates.
- Maintain pinned dependency versions in `pubspec.lock` and inspect dependencies regularly for known security vulnerabilities.
