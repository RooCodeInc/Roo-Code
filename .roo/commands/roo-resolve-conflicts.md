---
description: "Resolve merge conflicts intelligently using git history analysis"
argument-hint: "#PR-number"
mode: merge-resolver
---

Resolve merge conflicts for a specific pull request by analyzing git history, commit messages, and code changes to make intelligent resolution decisions.

## Quick Start

1. **Provide a PR number** (e.g., `#123` or just `123`)

2. The workflow will automatically:
   - Fetch PR information (title, description, branches)
   - Checkout the PR branch
   - Rebase onto the target branch to reveal conflicts
   - Analyze and resolve conflicts using git history

## Workflow Steps

### 1. Initialize PR Resolution

```bash
# Fetch PR info
gh pr view [PR_NUMBER] --json title,body,headRefName,baseRefName

# Checkout and rebase
gh pr checkout [PR_NUMBER] --force
git fetch origin main
GIT_EDITOR=true git rebase origin/main
```

### 2. Identify Conflicts

```bash
git status --porcelain | grep "^UU"
```

### 3. Analyze Each Conflict

For each conflicted file:
- Read the conflict markers
- Run `git blame` on conflicting sections
- Fetch commit messages for context
- Determine the intent behind each change

### 4. Apply Resolution Strategy

Based on the analysis:
- **Bugfixes** generally take precedence over features
- **Recent changes** are often more relevant (unless older is a security fix)
- **Combine** non-conflicting changes when possible
- **Preserve** test updates alongside code changes

### 5. Complete Resolution

```bash
git add [resolved-files]
GIT_EDITOR=true git rebase --continue
```

## Key Guidelines

- Always escape conflict markers with `\` when using `apply_diff`
- Document resolution decisions in the summary
- Verify no syntax errors after resolution
- Preserve valuable changes from both sides when possible

## Examples

- `/roo-resolve-conflicts #123` - Resolve conflicts for PR #123
- `/roo-resolve-conflicts 456` - Resolve conflicts for PR #456
