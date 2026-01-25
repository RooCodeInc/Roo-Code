# Code Quality Rules

1. Test Coverage:

    - Before attempting completion, always make sure that any code changes have test coverage
    - Ensure all tests pass before submitting changes
    - The vitest framework is used for testing; the `vi`, `describe`, `test`, `it`, etc functions are defined by default in `tsconfig.json` and therefore don't need to be imported from `vitest`
    - Tests must be run from the same directory as the `package.json` file that specifies `vitest` in `devDependencies`
    - Run tests with: `npx vitest run <relative-path-from-workspace-root>`
    - Do NOT run tests from project root - this causes "vitest: command not found" error
    - Tests must be run from inside the correct workspace:
        - Backend tests: `cd src && npx vitest run path/to/test-file` (don't include `src/` in path)
        - UI tests: `cd webview-ui && npx vitest run src/path/to/test-file`
    - Example: For `src/tests/user.test.ts`, run `cd src && npx vitest run tests/user.test.ts` NOT `npx vitest run src/tests/user.test.ts`

2. Lint Rules:

    - Never disable any lint rules without explicit user approval

3. Styling Guidelines:

    - Use Tailwind CSS classes instead of inline style objects for new markup
    - VSCode CSS variables must be added to webview-ui/src/index.css before using them in Tailwind classes
    - Example: `<div className="text-md text-vscode-descriptionForeground mb-2" />` instead of style objects

4. Marketing Site (web-roo-code) Deployment Quality Gates:

    - The marketing site deployment workflows (`.github/workflows/website-deploy.yml`, `.github/workflows/website-preview.yml`) must include quality checks before deploying to Vercel
    - When modifying these workflows, ensure the following checks run before deployment:
        - Linting: `pnpm --filter @roo-code/web-roo-code lint`
        - Type checking: `pnpm --filter @roo-code/web-roo-code check-types`
        - Build validation: `pnpm --filter @roo-code/web-roo-code build`
    - Deployment workflows should either:
        - Add a `needs:` dependency on the `code-qa` workflow (for PR-based deployments), OR
        - Include a dedicated `quality-checks` job that runs before the `deploy`/`preview` jobs
    - For PR-based preview deployments (`website-preview.yml`):
        - The quality checks job should be a required status check in GitHub branch protection
        - This prevents merging PRs with broken previews or failed quality checks
        - Ensures reviewers only see working previews
    - Deployment concurrency controls:
        - Add `concurrency` group to prevent multiple deployments from running simultaneously
        - Set `cancel-in-progress: true` to cancel older deployments when new ones start
        - Prevents race conditions where older commits could overwrite newer deployments
    - Vercel CLI version stability:
        - Use `vercel@latest` instead of `vercel@canary` for stable, production deployments
        - Canary releases are unstable and could introduce breaking changes unexpectedly
        - Pin to specific versions for critical production workflows when possible
    - Never deploy broken code to production - quality gates prevent deployment of code that fails linting, type-checking, or build steps
