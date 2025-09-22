# Contributing to Charles

Charles is a community-driven project, and we deeply value every contribution. To streamline collaboration, we operate on an [Issue-First](#issue-first-approach) basis, meaning all [Pull Requests (PRs)](#submitting-a-pull-request) must first be linked to a GitHub Issue. Please review this guide carefully.

## Table of Contents

- [Before You Contribute](#before-you-contribute)
- [Finding & Planning Your Contribution](#finding--planning-your-contribution)
- [Development & Submission Process](#development--submission-process)
- [Legal](#legal)

## Before You Contribute

### 1. Code of Conduct

All contributors must adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md).

### 2. Project Roadmap

Our roadmap guides the project's direction. Align your contributions with these key goals:

### Reliability First

- Ensure diff editing and command execution are consistently reliable.
- Reduce friction points that deter regular usage.
- Guarantee smooth operation across all locales and platforms.
- Expand robust support for a wide variety of AI providers and models.

### Enhanced User Experience

- Streamline the UI/UX for clarity and intuitiveness.
- Continuously improve the workflow to meet the high expectations developers have for daily-use tools.

### Leading on Agent Performance

- Establish comprehensive evaluation benchmarks (evals) to measure real-world productivity.
- Make it easy for everyone to easily run and interpret these evals.
- Ship improvements that demonstrate clear increases in eval scores.

Mention alignment with these areas in your PRs.

### 3. Join the Charles Community

- **Primary:** Experienced contributors can engage directly via [GitHub Projects](https://github.com/Newton-School).

## Finding & Planning Your Contribution

### Types of Contributions

- **Bug Fixes:** Addressing code issues.
- **New Features:** Adding functionality.
- **Documentation:** Improving guides and clarity.

### Issue-First Approach

All contributions must begin with a GitHub Issue.

- **Check existing issues**: Search [GitHub Issues](https://github.com/Newton-School/charles/issues).
- **Create an issue**: Use appropriate templates:
    - **Bugs:** "Bug Report" template.
    - **Features:** "Detailed Feature Proposal" template. Approval required before starting.
- **Claim issues**: Comment and await official assignment.

**PRs without approved issues may be closed.**

### Deciding What to Work On

- Check the [GitHub Project](https://github.com/orgs/Newton-School/projects/1) for unassigned "Good First Issues."
- For docs, visit [Charles Docs](https://github.com/Newton-School/charles).

### Reporting Bugs

- Check for existing reports first.
- Create new bugs using the ["Bug Report" template](https://github.com/Newton-School/charles/issues/new/choose).
- **Security issues**: Report privately via [security advisories](https://github.com/Newton-School/charles/security/advisories/new).

## Development & Submission Process

### Development Setup

1. **Fork & Clone:**

```
git clone https://github.com/YOUR_USERNAME/charles.git
```

2. **Install Dependencies:**

```
pnpm install
```

3. **Debugging:** Open with VS Code (`F5`).

### Writing Code Guidelines

- One focused PR per feature or fix.
- Follow ESLint and TypeScript best practices.
- Write clear, descriptive commits referencing issues (e.g., `Fixes #123`).
- Provide thorough testing (`npm test`).
- Rebase onto the latest `main` branch before submission.

### Submitting a Pull Request

- Begin as a **Draft PR** if seeking early feedback.
- Clearly describe your changes following the Pull Request Template.
- Provide screenshots/videos for UI changes.
- Indicate if documentation updates are necessary.

### Pull Request Policy

- Must reference pre-approved, assigned issues.
- PRs without adherence to the policy may be closed.
- PRs should pass CI tests, align with the roadmap, and have clear documentation.

### Review Process

- **Daily Triage:** Quick checks by maintainers.
- **Weekly In-depth Review:** Comprehensive assessment.
- **Iterate promptly** based on feedback.

## Legal

By contributing, you agree your contributions will be licensed under the Apache 2.0 License, consistent with Charles's licensing.
