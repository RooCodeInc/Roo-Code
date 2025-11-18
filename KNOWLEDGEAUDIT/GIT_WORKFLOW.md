# Git Workflow for Code Index Enhancement Project

**Document Version:** 1.0  
**Created:** 2025-11-18  
**Last Updated:** 2025-11-18  
**Status:** ✅ Active

---

## Overview

This document defines the git workflow, branching strategy, and commit conventions for the Roo Code Index enhancement project (Phases 1-8). Following these conventions ensures consistent, traceable, and reviewable development.

---

## Branching Strategy

### Main Branches

**`main`**
- Production-ready code
- Protected branch (requires PR approval)
- All Phase 0 foundation work committed here
- Serves as the base for feature branches

**`feature/code-index-enhancements`**
- Primary development branch for Phases 1-8
- Created from `main` at commit `7568d9d42`
- All enhancement work happens here or in sub-branches
- Will be merged back to `main` after Phase 8 completion

### Branch Naming Conventions

For work that requires separate branches from the main feature branch:

```
phase/<phase-number>-<short-description>
├── phase/1-system-prompts
├── phase/2-metadata-extraction
├── phase/3-bm25-search
├── phase/4-neo4j-integration
├── phase/5-lsp-integration
├── phase/6-hybrid-search
├── phase/7-advanced-features
└── phase/8-performance-polish

task/<phase>-<task-number>-<description>
├── task/1-1-analyze-prompts
├── task/2-3-implement-extractor
└── task/4-2-neo4j-ui

bugfix/<issue-description>
├── bugfix/vector-search-timeout
└── bugfix/metadata-parsing-error

experiment/<description>
├── experiment/alternative-chunking
└── experiment/embedding-caching
```

### Branch Lifecycle

1. **Create** - Branch from `feature/code-index-enhancements` or `main`
2. **Develop** - Make commits following commit conventions
3. **Test** - Ensure all tests pass before merging
4. **Review** - Create PR for review (if working with team)
5. **Merge** - Merge back to parent branch
6. **Delete** - Delete branch after successful merge

---

## Commit Message Conventions

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat** - New feature or enhancement
- **fix** - Bug fix
- **docs** - Documentation changes
- **test** - Adding or updating tests
- **refactor** - Code refactoring (no functional changes)
- **perf** - Performance improvements
- **chore** - Maintenance tasks (dependencies, build, etc.)
- **style** - Code style changes (formatting, whitespace)
- **ci** - CI/CD configuration changes

### Scopes

- **phase-0** - Foundation & Setup
- **phase-1** - System Prompt Improvements
- **phase-2** - Enhanced Metadata Extraction
- **phase-3** - BM25 Keyword Search
- **phase-4** - Neo4j Graph Relationships
- **phase-5** - LSP Integration
- **phase-6** - Hybrid Search & Routing
- **phase-7** - Advanced Features
- **phase-8** - Performance & Polish
- **docs** - Documentation updates
- **tests** - Test-related changes
- **config** - Configuration changes

### Examples

```bash
# Feature addition
feat(phase-1): enhance system prompts with code structure awareness

Added detailed code structure context to system prompts including:
- Symbol hierarchy information
- Import/export relationships
- Type definitions and interfaces

Closes #123

# Bug fix
fix(phase-3): resolve BM25 scoring normalization issue

Fixed incorrect score normalization in BM25 algorithm that was
causing poor ranking for short documents.

# Documentation
docs(phase-4): add Neo4j UI implementation guide

Created comprehensive UI implementation plan for Neo4j settings
panel including component design and message handlers.

# Performance improvement
perf(phase-8): optimize vector search with caching layer

Implemented LRU cache for frequently accessed embeddings,
reducing search latency by 40%.

# Test addition
test(phase-2): add metadata extraction test suite

Added comprehensive tests for metadata extraction covering:
- Symbol extraction
- Relationship detection
- Edge cases (unicode, nested structures)
```

### Subject Line Rules

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Maximum 72 characters
- Be specific and descriptive

### Body Rules

- Wrap at 72 characters
- Explain **what** and **why**, not **how**
- Use bullet points for multiple changes
- Reference issues/PRs when applicable

### Footer Rules

- Reference issues: `Closes #123`, `Fixes #456`, `Relates to #789`
- Breaking changes: `BREAKING CHANGE: description`
- Co-authors: `Co-authored-by: Name <email>`

---

## Merge Strategy

### Pull Request Process

1. **Create PR** - From feature branch to target branch
2. **Description** - Include:
   - What changed
   - Why it changed
   - How to test
   - Screenshots (if UI changes)
   - Related issues/tasks
3. **Review** - At least 1 approval required (if team)
4. **Tests** - All CI checks must pass
5. **Merge** - Use "Squash and merge" for clean history

### Merge Commit Format

```
<type>(<scope>): <summary> (#PR-number)

<detailed description>
```

Example:
```
feat(phase-4): implement Neo4j graph integration (#42)

- Added Neo4j client with connection pooling
- Implemented relationship extraction and storage
- Created graph query service for code relationships
- Added UI settings panel for Neo4j configuration

Closes #38, #39, #40
```

---

## Development Workflow

### Starting New Work

```bash
# Ensure you're on the feature branch
git checkout feature/code-index-enhancements

# Pull latest changes
git pull origin feature/code-index-enhancements

# Create task branch (if needed)
git checkout -b task/1-1-analyze-prompts

# Make changes...
```

### Committing Changes

```bash
# Stage changes
git add <files>

# Commit with conventional message
git commit -m "feat(phase-1): add code structure context to prompts"

# Push to remote
git push origin task/1-1-analyze-prompts
```

### Merging Back

```bash
# Switch to feature branch
git checkout feature/code-index-enhancements

# Merge task branch
git merge task/1-1-analyze-prompts

# Delete task branch
git branch -d task/1-1-analyze-prompts

# Push to remote
git push origin feature/code-index-enhancements
```

---

## Phase-Specific Guidelines

### Phase 0: Foundation & Setup ✅ COMPLETE

**Branch:** `main`
**Status:** All tasks committed to main branch
**Commits:**
- `408a448f3` - Add comprehensive implementation roadmap
- `3f23dbb5e` - Add test fixtures for Python, Rust, and TypeScript
- `7568d9d42` - Add baseline performance metrics and analysis scripts

### Phase 1-8: Enhancement Implementation

**Branch:** `feature/code-index-enhancements`
**Strategy:**
- All work happens on this branch or sub-branches
- Commit frequently with descriptive messages
- Keep commits atomic (one logical change per commit)
- Merge sub-branches back to feature branch regularly

---

## Best Practices

### Commit Frequency

✅ **DO:**
- Commit after completing a logical unit of work
- Commit before switching tasks
- Commit before major refactoring
- Commit when tests pass

❌ **DON'T:**
- Commit broken code to shared branches
- Make commits with unrelated changes
- Commit generated files (unless necessary)
- Make "WIP" commits on shared branches

### Commit Size

**Ideal commit:**
- Changes 1-5 files
- Adds/modifies 50-200 lines
- Has a single, clear purpose
- Can be reverted independently

**Too small:**
- Fixing a typo (combine with related changes)
- Adding a single comment

**Too large:**
- Implementing entire phase in one commit
- Mixing refactoring with new features
- Changing >20 files

### Code Review Guidelines

**For Authors:**
- Keep PRs focused and reasonably sized
- Provide context in PR description
- Respond to feedback promptly
- Update PR based on review comments

**For Reviewers:**
- Review within 24-48 hours
- Be constructive and specific
- Test the changes locally if possible
- Approve only when confident

---

## Git Hooks (Optional)

### Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Run linter before commit
pnpm lint-staged

# Run type checking
pnpm check-types

# Exit with error if checks fail
if [ $? -ne 0 ]; then
  echo "Pre-commit checks failed. Fix errors before committing."
  exit 1
fi
```

### Commit-msg Hook

Create `.git/hooks/commit-msg`:

```bash
#!/bin/bash
# Validate commit message format
commit_msg=$(cat "$1")

# Check for conventional commit format
if ! echo "$commit_msg" | grep -qE "^(feat|fix|docs|test|refactor|perf|chore|style|ci)(\(.+\))?: .+"; then
  echo "Error: Commit message must follow conventional commit format"
  echo "Example: feat(phase-1): add new feature"
  exit 1
fi
```

---

## Troubleshooting

### Merge Conflicts

```bash
# Update your branch with latest changes
git checkout feature/code-index-enhancements
git pull origin feature/code-index-enhancements

# Merge main into your branch
git merge main

# Resolve conflicts in your editor
# Then stage resolved files
git add <resolved-files>

# Complete the merge
git commit
```

### Undo Last Commit (Not Pushed)

```bash
# Keep changes, undo commit
git reset --soft HEAD~1

# Discard changes, undo commit
git reset --hard HEAD~1
```

### Undo Last Commit (Already Pushed)

```bash
# Create a new commit that reverts the changes
git revert HEAD

# Push the revert commit
git push origin feature/code-index-enhancements
```

### Amend Last Commit

```bash
# Make additional changes
git add <files>

# Amend the last commit
git commit --amend

# Force push if already pushed (use with caution)
git push --force-with-lease origin feature/code-index-enhancements
```

---

## Repository State Verification

### Check for Uncommitted Changes

```bash
git status
```

### Check Branch Status

```bash
# List all branches
git branch -a

# Show current branch
git branch --show-current

# Show branch tracking info
git branch -vv
```

### Verify .gitignore

Ensure the following are ignored:

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
out/
*.vsix

# IDE
.vscode/settings.json
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Environment
.env
.env.local

# Test coverage
coverage/
.nyc_output/

# Temporary files
*.tmp
*.temp
.cache/
```

---

## Current Repository State

### Active Branch

```
feature/code-index-enhancements
```

**Created:** 2025-11-18
**Based on:** `main` at commit `7568d9d42`
**Purpose:** Implement Phases 1-8 of code index enhancements
**Status:** Ready for Phase 1 implementation

### Branch History

```
main (7568d9d42)
  └── feature/code-index-enhancements (current)
```

### Phase 0 Commits on Main

1. **408a448f3** - Add comprehensive implementation roadmap
   - Created IMPLEMENTATION_ROADMAP.md
   - Created PROGRESS_TRACKER.md
   - Documented 8-phase enhancement plan

2. **3f23dbb5e** - Add test fixtures
   - Created 23 test fixture files
   - Covered 8 programming languages
   - ~4,975 lines of test code

3. **7568d9d42** - Add baseline metrics
   - Created BASELINE_METRICS.md
   - Created analysis scripts
   - Documented measurement methodology

---

## Next Steps

### Immediate (Task 0.4)

- [x] Create development branch ✅
- [x] Document git workflow ✅
- [ ] Update PROGRESS_TRACKER.md
- [ ] Commit GIT_WORKFLOW.md
- [ ] Mark Phase 0 as complete

### Phase 1 Preparation

1. **Review Phase 1 Requirements**
   - Read IMPLEMENTATION_ROADMAP.md Phase 1 section
   - Understand system prompt improvement goals
   - Identify files to modify

2. **Set Up Development Environment**
   - Ensure VSCode extension development setup
   - Configure embedding provider for testing
   - Set up local Qdrant instance

3. **Begin Implementation**
   - Start with Task 1.1: Analyze Current Prompts
   - Follow git workflow conventions
   - Commit frequently with descriptive messages

---

## Summary

This git workflow provides:

✅ **Clear branching strategy** - Feature branch for all enhancement work
✅ **Consistent commit conventions** - Conventional commits for traceability
✅ **Merge guidelines** - PR process and merge strategies
✅ **Best practices** - Commit frequency, size, and review guidelines
✅ **Troubleshooting** - Common git operations and fixes
✅ **Repository state** - Current branch status and history

**The repository is now ready for Phase 1 implementation!**

---

**Document Status:** ✅ Complete
**Branch Status:** ✅ `feature/code-index-enhancements` created and active
**Phase 0 Status:** ✅ Ready to mark complete


