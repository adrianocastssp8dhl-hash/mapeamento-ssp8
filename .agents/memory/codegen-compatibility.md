---
name: API code generation compatibility
description: Orval may infer incorrect library versions from a workspace package without runtime dependencies.
---

Pin generated-client library versions explicitly when the generator package does not itself declare those libraries; do not rely on auto-detection across workspace packages.

**Why:** Orval fell back to React Query v4 even though the frontend uses v5. Newer generated request helpers also use iterable browser Headers and require the DOM iterable TypeScript library.

**How to apply:** When updating Orval or regenerating clients, preserve explicit query-major settings and verify the client package's browser library compatibility rather than editing generated output.
