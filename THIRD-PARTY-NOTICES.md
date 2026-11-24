# Third-Party Software Notices and Licences

The Universal Security Standard (USS) repository incorporates or depends upon the following third-party open-source software component:

---

## yaml

- **Package:** `yaml`
- **Version:** `2.9.1`
- **Component Purpose:** Used solely in development and CI test suites (`tests/workflow-security.test.mjs`) to parse and validate GitHub Actions workflow YAML structures. Core USS tools (`tools/resolve-task.mjs`, `tools/checksums.mjs`, `tools/validate.mjs`, `tools/validate-evidence.mjs`) use Node.js standard library modules and have zero external dependencies.
- **Project URL:** https://github.com/eemeli/yaml
- **Licence:** ISC License

### Licence Text:

```text
Copyright Eemeli Aro <eemeli@gmail.com>

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```
