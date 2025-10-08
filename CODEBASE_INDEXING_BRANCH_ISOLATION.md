# Branch Isolation for Codebase Indexing

Enable separate code indexes for each Git branch to prevent conflicts and ensure accurate search results when working across multiple branches.

### Key Features
- **Conflict-Free Branch Switching**: Each branch maintains its own independent index
- **Accurate Search Results**: Search results always reflect the code in your current branch
- **Opt-In Design**: Disabled by default to maintain backward compatibility and minimize storage usage
- **Automatic Branch Detection**: Automatically detects your current Git branch and uses the appropriate index

---

## Use Case

**Before (Without Branch Isolation)**:
- Switching branches could show outdated or incorrect search results
- Index conflicts when multiple developers work on different branches
- Manual re-indexing required after branch switches to ensure accuracy
- Confusion when search results don't match the current branch's code

**With Branch Isolation**:
- Each branch has its own dedicated index
- Search results are always accurate for your current branch
- No manual intervention needed when switching branches
- Multiple team members can work on different branches without conflicts

## How It Works

When branch isolation is enabled, Roo Code creates a separate Qdrant collection for each Git branch you work on. The collection naming convention is:

```
ws-{workspace-hash}-br-{sanitized-branch-name}
```

For example:
- `main` branch → `ws-a1b2c3d4e5f6g7h8-br-main`
- `feature/user-auth` branch → `ws-a1b2c3d4e5f6g7h8-br-feature-user-auth`
- `bugfix/issue-123` branch → `ws-a1b2c3d4e5f6g7h8-br-bugfix-issue-123`

When you switch branches in Git, Roo Code automatically detects the change and uses the appropriate index for that branch.

---

## Configuration

### Enabling Branch Isolation

1. Open the **Codebase Indexing** settings dialog
2. Expand the **Advanced Configuration** section
3. Check the **"Enable Branch Isolation"** checkbox
4. Click **Save** to apply the changes

**Setting**: `codebaseIndexBranchIsolationEnabled`  
**Default**: `false` (disabled)  
**Type**: Boolean

### Storage Implications

> ⚠️ **Storage Warning**
>
> Each branch will have its own index, increasing storage requirements.
> - **Impact**: Storage usage multiplies by the number of branches you work on
> - **Example**: If one branch's index uses 100MB, working on 5 branches will use ~500MB
> - **Recommendation**: Enable only if you frequently switch between branches or work in a team environment

---

## Technical Details

### Collection Naming

Branch names are sanitized to ensure valid Qdrant collection names:
- Non-alphanumeric characters (except `-` and `_`) are replaced with `-`
- Multiple consecutive dashes are collapsed to a single dash
- Leading and trailing dashes are removed
- Names are converted to lowercase
- Maximum length is 50 characters
- If sanitization results in an empty string, `"default"` is used

**Examples**:
- `feature/user-auth` → `feature-user-auth`
- `bugfix/ISSUE-123` → `bugfix-issue-123`
- `release/v2.0.0` → `release-v2-0-0`

### Branch Detection

The current Git branch is detected by reading the `.git/HEAD` file:
- If on a named branch: Uses the branch name
- If on detached HEAD: Falls back to workspace-only collection name
- If not in a Git repository: Falls back to workspace-only collection name

### Backward Compatibility

When branch isolation is **disabled** (default):
- Collection naming remains unchanged: `ws-{workspace-hash}`
- Existing indexes continue to work without modification
- No migration or re-indexing required

When branch isolation is **enabled**:
- New collections are created per branch
- Existing workspace-only collections are not automatically migrated
- You may need to re-index to populate branch-specific collections

---

## Best Practices

### When to Enable Branch Isolation

✅ **Enable if**:
- You frequently switch between multiple branches
- You work in a team where different members work on different branches
- You need accurate search results specific to each branch
- You have sufficient storage space available

❌ **Keep disabled if**:
- You primarily work on a single branch
- Storage space is limited
- You're working on a small personal project
- You don't experience issues with branch switching

### Managing Storage

To minimize storage usage while using branch isolation:

1. **Clean up old branches**: Delete indexes for branches you no longer use
2. **Selective enabling**: Only enable for projects where branch isolation is critical
3. **Monitor storage**: Keep an eye on Qdrant storage usage in your system

### Team Workflows

For teams using branch isolation:

1. **Consistent settings**: Ensure all team members have the same branch isolation setting
2. **Documentation**: Document your team's branch isolation policy in your project README
3. **CI/CD considerations**: Branch isolation doesn't affect CI/CD pipelines (they don't use local indexes)

---

## Troubleshooting

### Search results don't match my current branch

**Possible causes**:
- Branch isolation is disabled
- Index hasn't been updated after branch switch
- Git branch detection failed

**Solutions**:
1. Verify branch isolation is enabled in settings
2. Check that you're on the expected Git branch: `git branch --show-current`
3. Trigger a manual re-index if needed

### Storage usage is too high

**Solutions**:
1. Disable branch isolation if not needed
2. Clear indexes for old/unused branches
3. Use Qdrant's storage management tools to monitor and clean up collections

### Branch name not detected

**Possible causes**:
- Detached HEAD state
- Not in a Git repository
- `.git/HEAD` file is corrupted

**Solutions**:
1. Ensure you're on a named branch: `git checkout <branch-name>`
2. Verify you're in a Git repository: `git status`
3. Check `.git/HEAD` file exists and is readable

---

## FAQ

**Q: Will enabling branch isolation delete my existing index?**  
A: No. Your existing workspace-level index remains unchanged. New branch-specific indexes are created separately.

**Q: What happens if I switch branches while indexing is in progress?**  
A: The indexing operation completes for the original branch. When you switch branches, a new indexing operation may start for the new branch.

**Q: Can I migrate my existing index to use branch isolation?**  
A: There's no automatic migration. When you enable branch isolation, you'll need to re-index to populate the branch-specific collections.

**Q: Does branch isolation work with detached HEAD?**  
A: No. In detached HEAD state, the system falls back to the workspace-only collection name.

**Q: How do I delete indexes for old branches?**  
A: Use Qdrant's collection management API or UI to delete collections matching the pattern `ws-{hash}-br-{old-branch-name}`.

**Q: Does this affect performance?**  
A: No. Search performance is the same whether branch isolation is enabled or disabled. Only storage usage is affected.

---

## Related Features

- **Codebase Indexing**: The main feature that enables semantic code search
- **Qdrant Vector Database**: The underlying storage system for code embeddings
- **Git Integration**: Branch detection relies on Git repository information

---

## References

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Qdrant Collections](https://qdrant.tech/documentation/concepts/collections/)
- [Roo Code Documentation](https://docs.roocode.com)
- [Git Branch Documentation](https://git-scm.com/docs/git-branch)

---

**Last Updated**: 2025-01-08  
**Feature Version**: 1.0.0  
**Status**: Stable

