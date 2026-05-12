---
sidebar_label: "Multi-File Edits"
description: "Speed up refactoring and multi-file changes with Roo Code's Concurrent File Edits feature. Edit multiple files in a single operation with batch approval."
keywords:
    - concurrent file edits
    - multi-file edits
    - batch editing
    - refactoring
    - apply_diff
    - "batch approval"
---

# Concurrent File Edits (AKA Multi-File Edits)

:::note
Multi-file edits have graduated from experimental status and are now enabled by default. You no longer need to enable this feature in settings.
:::

Edit multiple files in a single operation, dramatically speeding up refactoring and multi-file changes.

---

## What It Does

<img src="/img/concurrent-file-edits/concurrent-file-edits-1.png" alt="Batch diff approval interface showing multiple file changes" width="800" />

Concurrent File Edits allows Roo to modify multiple files in your workspace within a single request. Instead of approving each file edit individually, you review and approve all changes at once through a unified batch approval interface.

---

## Why Use It

**Traditional approach**: Sequential file edits requiring individual approvals

- Edit file A → Approve
- Edit file B → Approve
- Edit file C → Approve

**With Concurrent File Edits**: All changes presented together

- Review all proposed changes across files A, B, and C
- Approve once to apply all changes

This reduces interruptions and speeds up complex tasks like:

- Refactoring functions across multiple files
- Updating configuration values throughout your codebase
- Renaming components and their references
- Applying consistent formatting or style changes

---

## Availability

Multi-file edits are now available by default in Roo Code. The feature has graduated from experimental status and no longer requires manual activation in settings.

---

## Using the Feature

When enabled, Roo automatically uses concurrent edits when appropriate. You'll see a "Batch Diff Approval" interface showing:

- All files to be modified
- Proposed changes for each file
- Options to approve all changes or review individually

### Example Workflow

1. Ask Roo to "Update all API endpoints to use the new authentication method"
2. Roo analyzes your codebase and identifies all affected files
3. You receive a single batch approval request showing changes across:
    - `src/api/users.js`
    - `src/api/products.js`
    - `src/api/orders.js`
    - `src/middleware/auth.js`
4. Review all changes in the unified diff view
5. Approve to apply all changes simultaneously

---

## Technical Details

This feature leverages the [`apply_diff`](/advanced-usage/available-tools/apply-diff) tool's multi-file capabilities. For detailed information about the implementation and diff format, see the [apply_diff documentation](/advanced-usage/available-tools/apply-diff).

---

## Best Practices

- Use with capable AI models (Claude 3.5 Sonnet, GPT-4, etc.) for best results
- Review all proposed changes carefully before approving
- For very large batch operations, consider breaking the task into smaller chunks

---

## Limitations

- **Model dependent**: Works best with more capable AI models
- **Token usage**: Initial requests may use more tokens due to larger context
- **Complexity**: Very large batch operations might be harder to review

---

## Troubleshooting

### Changes Not Batching

- Check that your model supports multi-file operations
- Ensure files aren't restricted by `.rooignore`

### Approval UI Not Appearing

- Update to the latest version of Roo Code
- Check VS Code's output panel for errors
- Try disabling and re-enabling the feature

### Performance Issues

- For very large batches, consider breaking the task into smaller chunks
- Monitor token usage if working with limited API quotas

---

## See Also

- [`apply_diff` Tool Documentation](/advanced-usage/available-tools/apply-diff) - Detailed technical information
- [Experimental Features](/features/experimental/experimental-features) - Other experimental capabilities
- [`.rooignore` Configuration](/features/rooignore) - File access restrictions
