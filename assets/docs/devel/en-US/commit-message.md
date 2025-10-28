# CoStrict Commit Message Specification

We adhere to the Angular specification, which enforces precise rules for Git commit formatting to make the commit history more readable.

A compliant Angular-style commit message contains three parts: **Header**, **Body**, and **Footer**, formatted as follows:

```
<type>[optional scope]: <description>
<BLANK LINE>
[optional body]
<BLANK LINE>
[optional footer(s)]
```

**Header** is required, **Body** and **Footer** can be omitted.

Here is an Angular-style compliant commit message:

```
feat(config): add validation mode for JWT tokens

Add `validationMode` option to enforce strict JWT validation as per RFC 7519.
Default value 'loose' maintains backward compatibility.

Closes #392
BREAKING CHANGE: `legacyCheck` method removed
Use `secureValidate` with `{ validationMode: 'strict' }` instead.
Update config before v3.0 release.
```

Ensure that no line in the commit message exceeds 100 characters.

Next, let's examine the three parts of the Angular-style Commit Message in detail.

## Header

The Header is a single line containing three fields: `type` (required), `scope` (optional), and `subject` (required).

### type

Specifies the commit type. Common types include:

- **feat**: New feature
- **fix**: Bug fix
- **perf**: Performance optimization
- **style**: Code formatting changes (e.g., whitespace removal)
- **refactor**: Code changes not covered by feat/fix/perf/style (e.g., code simplification, renaming)
- **test**: Adding or modifying tests
- **ci**: CI/CD configuration changes (e.g., Jenkins, GitLab CI)
- **docs**: Documentation updates
- **chore**: Maintenance tasks (dependencies, tooling, etc.)
- **change**: Breaking changes

### scope

Indicates the scope of changes (a noun). Must be wrapped in parentheses followed by a colon and space:
Example: `(auth):`

### subject

A concise description starting with a lowercase verb in present tense (e.g., "fix" not "fixed").
Do NOT end with a period.

## Body

Optional detailed description of the commit.

- Written in present tense
- Must explain motivation and differences from previous versions

Example:

```
Safari 15.4+ enforces stricter CORS policies for localStorage access,
causing intermittent auth failures. Added retry logic for token refresh.
```

## Footer

The Footer is optional and primarily used to describe consequences of the commit. In practice, it typically documents breaking changes and closes issues, formatted as follows:

```
BREAKING CHANGE: <breaking change summary>
<BLANK LINE>
<breaking change description + migration instructions>
<BLANK LINE>
<BLANK LINE>
Fixes #<issue number>
```

Next, I'll explain these two scenarios in detail:

- **Breaking changes**: If the code introduces backward incompatibility, the Footer must start with `BREAKING CHANGE:`, followed by a summary. The remaining Footer content should describe:
    - The nature of the change
    - Reasoning behind it
    - Migration steps

Example:

```
BREAKING CHANGE: Legacy token validation removed
The deprecated `auth.legacyCheck` method is no longer supported.
Migration: Use `auth.secureValidate` with JWT v2.0+ tokens and
set `{ validationMode: 'strict' }` in config.
```

- **Closing issues list**: Closed bugs should be added in the Footer section on a new line starting with `Closes`, e.g., `Closes #123`. For multiple issues, list them as: `Closes #123, #432, #886`.

Example:

```
Safari 15.4+ enforces stricter CORS policies for localStorage access,
causing intermittent auth failures. Added retry logic for token refresh.

Closes #392
```

## Revert Commit

In addition to the three standard parts (Header, Body, Footer), a Commit Message may have a special case: If the commit reverts a previous commit, the message must start with `revert:` followed by the Header of the reverted commit. The Body must include `This reverts commit <hash>`, where `<hash>` is the SHA of the reverted commit.

Example:

```
revert: feat: add 'Host' option
This reverts commit bb42d749a7d129db0546bf89a48f84ec127843ce.
```
