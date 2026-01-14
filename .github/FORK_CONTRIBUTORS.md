# Contributing from a Fork

Thank you for contributing to Roo Code! If you're contributing from a forked repository, please be aware of the following regarding CI workflows.

## Integration Tests for Fork PRs

**Important**: Integration tests (E2E tests) will be **skipped automatically** for pull requests from forked repositories.

### Why Are Tests Skipped?

For security reasons, GitHub does not expose repository secrets (like API keys) to workflows triggered by pull requests from forks. This is a critical security feature that prevents malicious actors from:

- Stealing API keys
- Running up costs on paid API services
- Accessing sensitive infrastructure

Since our integration tests require an OpenRouter API key (`OPENROUTER_API_KEY` secret) to test real AI interactions, they cannot run on fork PRs without this secret.

### What This Means for Your PR

1. **Your PR will show integration tests as "skipped"** - this is expected and normal
2. **Other CI checks will still run** - linting, type checking, unit tests, etc.
3. **A maintainer will review your PR** - after code review, maintainers can:
    - Trigger integration tests manually
    - Merge your PR to a branch in the main repo where tests can run
    - Run tests locally before merging

### What You Should Do

1. **Ensure all other CI checks pass** - unit tests, linting, type checking
2. **Test your changes locally** if possible:
    - Follow the E2E testing guide in [`apps/vscode-e2e/README.md`](../apps/vscode-e2e/README.md)
    - Set up your own OpenRouter API key for local testing
3. **Provide clear testing evidence** in your PR description:
    - Screenshots or videos of functionality working
    - Description of manual testing performed
    - Any relevant logs or output
4. **Be patient** - maintainers will run full integration tests during review

### Running Integration Tests Locally

If you want to run integration tests locally before submitting your PR:

1. **Get an OpenRouter API key**:

    - Sign up at [OpenRouter](https://openrouter.ai/)
    - Add credits to your account (tests cost ~$0.10-0.50 to run)

2. **Set up local environment**:

    ```bash
    cd apps/vscode-e2e
    cp .env.local.sample .env.local
    # Edit .env.local and add your OPENROUTER_API_KEY
    ```

3. **Run the tests**:
    ```bash
    pnpm test:ci
    ```

See the [E2E Testing README](../apps/vscode-e2e/README.md) for complete instructions.

### Alternative: Request Maintainer Testing

If you cannot run integration tests locally, you can:

1. Submit your PR with all other CI checks passing
2. Add a comment requesting integration test runs
3. A maintainer will review your code and run integration tests

## Other CI Workflows

The following workflows **will run** on fork PRs:

- ✅ **Linting** - Code style and quality checks
- ✅ **Type checking** - TypeScript type validation
- ✅ **Unit tests** - Fast, isolated tests without external dependencies
- ✅ **Translation checks** - Ensuring all translations are complete
- ✅ **Dependency checks** (Knip) - Unused dependency detection

These workflows provide significant code quality assurance even without integration tests.

## Questions?

If you have questions about fork contributions or testing:

- Check the [main CONTRIBUTING guide](../../CONTRIBUTING.md)
- Ask in the PR discussion
- Reach out in the community channels

Thank you for contributing to Roo Code!
