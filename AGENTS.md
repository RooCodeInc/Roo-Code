# AGENTS.md

This file provides guidance to agents when working with code in this repository.

- Settings View Pattern: When working on `SettingsView`, inputs must bind to the local `cachedState`, NOT the live `useExtensionState()`. The `cachedState` acts as a buffer for user edits, isolating them from the `ContextProxy` source-of-truth until the user explicitly clicks "Save". Wiring inputs directly to the live state causes race conditions.

## Cursor Cloud specific instructions

### Overview

This is a pnpm + Turborepo monorepo. Requires **Node.js 20.19.2** and **pnpm 10.8.1**. See `README.md` for general setup and `CONTRIBUTING.md` for contribution guidelines.

### Key commands (run from repo root)

| Task               | Command                               |
| ------------------ | ------------------------------------- |
| Install deps       | `pnpm install`                        |
| Lint (all)         | `pnpm lint`                           |
| Type-check (all)   | `pnpm check-types`                    |
| Test (all)         | `pnpm test`                           |
| Build shared types | `pnpm --filter @roo-code/types build` |

### Marketing site (`apps/web-roo-code`)

- **Dev server**: `pnpm --filter @roo-code/web-roo-code dev` (port 3000)
- **Build**: `pnpm --filter @roo-code/web-roo-code build`
- **Lint/Test**: `pnpm --filter @roo-code/web-roo-code lint` / `pnpm --filter @roo-code/web-roo-code test`
- The `@roo-code/types` package must be built before running or building the marketing site (`pnpm --filter @roo-code/types build`).
- The site depends on `@roo-code/evals` (workspace link) but that package has no build step.
- Optional env vars (`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_BASIN_ENDPOINT`, `NEXT_PUBLIC_SITE_URL`) are in `.env.example`; the site works without them.

### Gotchas

- Node version must be exactly 20.19.2 (enforced by `.nvmrc` / `.tool-versions`). Use `nvm use` after sourcing nvm.
- `pnpm install` may warn about ignored build scripts (e.g. `@tailwindcss/oxide`, `sharp`). These are non-blocking; the `pnpm.onlyBuiltDependencies` allowlist in root `package.json` controls which native builds run.
- Pre-commit hook runs `lint-staged` + `pnpm lint`; pre-push runs `pnpm check-types`.
