---
name: Workspace package installation
description: Dependency installation behavior in the pnpm monorepo.
---

Workspace package installers can target the monorepo root instead of the intended package when adding a dependency. Add runtime dependencies with the workspace package filter so they remain scoped to the service that imports them.

**Why:** Root-targeted installs are rejected by the workspace guard or place dependencies in the wrong package.

**How to apply:** For a package-specific dependency, use the package manager with `--filter @workspace/<package>` and verify that package's package.json and lockfile entry.