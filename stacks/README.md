# Stack-specific profiles

Stack profiles add framework- and runtime-specific implementation details to the universal modules. They do not replace or weaken USS policy.

## Profile status

- **REFERENCE ONLY:** A review checklist exists, but it has not been validated against a named consuming application and deployment.
- **VALIDATED FOR A NAMED APPLICATION:** The exact application commit, runtime and dependency versions, configuration, tests and reviewer are recorded in the profile.
- **DEPRECATED:** The profile is no longer maintained for supported versions or has been superseded.

No stack profile is currently marked VALIDATED. The available profiles are reference checklists only.

## Available reference profiles

- [Node.js and Express](nodejs-express.md)
- [Python and FastAPI](python-fastapi.md)
- [Laravel 11 and PHP](laravel-php.md)
- [React and TypeScript](react-typescript.md)
- [Flutter and Dart mobile](flutter-dart.md)

## Requirements for a validated profile

A profile must identify:

1. Supported runtime and framework version ranges, including the date they were checked.
2. Relevant universal USS modules and supplemental guidance.
3. Secure configuration expectations and known framework defaults.
4. Authentication, authorization, validation, transport, secret, data and operational controls relevant to the stack.
5. Negative tests and evidence requirements.
6. A named consuming application, exact commit, exact dependency versions, deployment assumptions, commands, test results, exceptions and reviewer.

A document that only lists recommended settings is not a validated profile. Do not mark a stack profile as validated based on documentation review or unit tests that do not exercise the consuming application's actual runtime and deployment.
