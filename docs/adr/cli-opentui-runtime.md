# ADR: CLI OpenTUI Runtime Strategy

- **Status:** Proposed
- **Date:** 2026-02-22
- **Issue:** [#11705](https://github.com/RooCodeInc/Roo-Code/issues/11705)
- **Decision Makers:** CLI team, core maintainers

## Context

The Roo CLI (`apps/cli`) currently uses [Ink](https://github.com/vadimdemedes/ink) v6.6.0 with React 19 for terminal UI rendering. The codebase spans ~10,619 LOC across 69 files in `apps/cli/src/ui/`. [OpenTUI](https://github.com/user/opentui) has been proposed as an alternative renderer offering potentially better performance and native terminal integration.

### Current Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Renderer | Ink | 6.6.0 |
| Component library | @inkjs/ui | 2.0.0 |
| UI framework | React | 19.1.0 |
| State management | Zustand | 5.0.0 |
| Runtime | Node.js | >=18 |
| Build | tsup | 8.4.0 |
| Test | Vitest + ink-testing-library | 4.0.0 |

### Key Constraints

1. **OpenTUI has no public npm package.** There is no published `opentui` package on npm. Integration requires either vendoring the source, using a git dependency, or waiting for an official release.
2. **OpenTUI's primary target is Bun.** The library is designed for the Bun runtime, with Node.js support being secondary or incomplete.
3. **The CLI ships as a Node.js application.** The `@roo-code/cli` package targets Node.js and is distributed via npm. Switching the runtime to Bun would affect the entire deployment pipeline and user installation experience.
4. **Ink is deeply integrated.** All 69 UI files import from `ink` or `@inkjs/ui`. The Ink-specific APIs used include `Box`, `Text`, `useInput`, `useApp`, `Select`, `Spinner`, `measureElement`, `DOMElement`, and `Newline`.
5. **Non-TUI modes must remain unaffected.** The `--print` flag and `--output-format stream-json` mode bypass the Ink renderer entirely (via TTY detection in `run.ts`) and must continue to work regardless of renderer choice.

## Decision

**Node.js-first with opt-in Bun experimental support.**

The CLI will continue to target Node.js as the primary runtime. OpenTUI integration, if pursued beyond prototype phase, will be gated behind an experimental `--runtime bun` flag (or similar mechanism). The Ink-based UI will remain the default and production renderer.

### Rationale

1. **User compatibility.** The vast majority of CLI users run Node.js. Requiring Bun would be a breaking change that limits adoption.
2. **No npm package available.** Without a published npm package, OpenTUI cannot be added as a standard dependency. This makes production use premature.
3. **Incremental migration path.** A dual-renderer architecture (Ink default, OpenTUI opt-in) allows evaluation without risk to existing users.
4. **Bun adoption trend.** If Bun gains wider adoption and OpenTUI publishes an npm package, the experimental flag can be promoted to default in a future release.

## Alternatives Considered

### 1. Full Bun migration

Replace Node.js runtime entirely with Bun for the CLI package.

- **Pros:** Native OpenTUI support, potentially faster startup
- **Cons:** Breaking change for all users, requires Bun installation, npm distribution story unclear, affects CI/CD pipeline
- **Verdict:** Rejected -- too disruptive for an experimental evaluation

### 2. Node.js-only with OpenTUI shim

Create a compatibility layer that runs OpenTUI's rendering primitives on Node.js without Bun.

- **Pros:** No runtime change needed
- **Cons:** Significant engineering effort, unclear if OpenTUI's internals can run on Node.js, maintenance burden
- **Verdict:** Deferred -- worth investigating if OpenTUI publishes Node.js support

### 3. Keep Ink, optimize existing renderer

Focus on optimizing the current Ink-based UI instead of migrating.

- **Pros:** No migration cost, proven technology, large community
- **Cons:** May not achieve the performance improvements that motivated the evaluation
- **Verdict:** Fallback option if OpenTUI evaluation does not yield meaningful improvements

## Consequences

### Positive

- No breaking changes to existing users
- Clear experimental boundary via feature flag
- Allows data-driven decision based on prototype results
- Maintains full backward compatibility with `--print` and `--output-format` modes

### Negative

- Dual-renderer maintenance overhead during evaluation period
- OpenTUI prototype may require vendored dependencies
- Additional CI complexity for Bun-based test paths

### Neutral

- ADR can be revisited once OpenTUI publishes an npm package or Node.js support improves
- The `feat/cli-ui-next-opentui` branch contains an existing SolidJS/OpenTUI prototype that can inform further work

## Implementation Notes

- Feature flag: `--ui opentui` (opt-in, defaults to `ink`)
- New UI code goes in `apps/cli/src/ui-next/` (already scaffolded on `feat/cli-ui-next-opentui` branch)
- Existing `apps/cli/src/ui/` remains untouched
- Entry point in `apps/cli/src/commands/cli/run.ts` already has TTY detection logic that can be extended for renderer selection
