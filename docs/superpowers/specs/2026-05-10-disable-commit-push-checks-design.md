# Disable local commit/push checks design

Date: 2026-05-10

## Problem
Repo currently enforces local Git checks through Husky hooks:
- `.husky/pre-commit` blocks commits to `main`
- `.husky/pre-commit` runs `lint-staged`
- `.husky/pre-commit` runs `pnpm lint`
- `.husky/pre-push` blocks pushes to `main`
- `.husky/pre-push` runs `check-types`
- `.husky/pre-push` may run tests
- `.husky/pre-push` prints changeset reminder

User wants all local commit/push enforcement removed.
User also wants `lint-staged` config removed from `package.json`.

## Goals
- Remove all local Husky checks from commit and push workflow.
- Remove branch protection logic from local Husky hooks.
- Remove `lint-staged` configuration from root `package.json`.
- Keep normal repo scripts (`lint`, `check-types`, `test`, etc.) available for manual use.

## Non-goals
- No CI workflow changes.
- No package script removals for `lint`, `check-types`, `test`, or `build`.
- No Husky uninstall.
- No change to hooks other than commit/push hooks.

## Design
### 1) Delete commit/push hook entrypoints
Delete:
- `.husky/pre-commit`
- `.husky/pre-push`

Result:
- no local commit blocking on `main`
- no local push blocking on `main`
- no automatic `lint-staged`, `lint`, `check-types`, test, or changeset reminder during commit/push

### 2) Keep Husky base wiring intact
Keep:
- `.husky/_/**`
- root `package.json` script: `"prepare": "husky"`

Reason:
- smallest change for requested scope
- avoids changing global Git hook bootstrap behavior
- commit/push checks disappear because entrypoint hook files are gone

### 3) Remove lint-staged config from package.json
Delete root-level `lint-staged` block from `package.json`.

Reason:
- user explicitly asked to remove it
- after deleting `.husky/pre-commit`, this config is unused
- removes stale config from repo root

## Data flow after change
Before:
1. `git commit` -> Husky runs `.husky/pre-commit`
2. hook blocks `main`, runs `lint-staged`, runs `pnpm lint`
3. `git push` -> Husky runs `.husky/pre-push`
4. hook blocks `main`, runs `check-types`, optional tests, changeset reminder

After:
1. `git commit` -> no repo-defined pre-commit entrypoint
2. `git push` -> no repo-defined pre-push entrypoint
3. manual checks still possible via package scripts

## Risks
- Developers can commit/push broken code locally without warning.
- Developers can commit/push directly to `main` locally unless remote branch protections exist.
- Formatting on staged files will no longer run automatically.

These risks are accepted by request.

## Testing
- Verify `.husky/pre-commit` no longer exists.
- Verify `.husky/pre-push` no longer exists.
- Verify `package.json` no longer contains `lint-staged` block.
- Optional smoke check: `git status` and `git commit` path should no longer invoke repo checks.

## Acceptance criteria
- `.husky/pre-commit` deleted.
- `.husky/pre-push` deleted.
- root `package.json` no longer contains `lint-staged` config.
- `prepare: husky` remains unchanged.
- local commit/push no longer run repo-defined checks.