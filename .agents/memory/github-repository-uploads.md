---
name: GitHub repository uploads
description: Constraints for creating and populating GitHub repositories through the connected GitHub integration.
---

When creating a new repository through the connected GitHub integration, create the first file with the Contents API before using Git database blob/tree/commit endpoints. Pace blob writes below the connector's 10-requests-per-second limit and retry HTTP 429 responses. The connector may block writes under `.github/workflows` at its Cloudflare edge; if that happens, publish a built static bundle under `docs/` and use legacy Pages source configuration.

**Why:** Empty GitHub repositories reject direct blob creation with a 409, and parallel blob uploads can exceed the connector's request-rate limit.

**How to apply:** For a full-project upload, bootstrap one real tracked file, then upload the remaining blobs with low concurrency and update the default branch after creating the complete tree and commit. For a static Pages fallback, upload the build output to `docs/` and set Pages to `main` plus `/docs`.