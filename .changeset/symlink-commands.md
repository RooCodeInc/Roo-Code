---
"roo-cline": minor
---

Add symlink support for slash commands in .roo/commands folder

This change adds support for symlinked slash commands, similar to how .roo/rules already handles symlinks:

- Symlinked command files are now resolved and their content is read from the target
- Symlinked directories are recursively scanned for .md command files
- Command names are derived from the symlink name, not the target file name
- Cyclic symlink protection (MAX_DEPTH = 5) prevents infinite loops
- Broken symlinks are handled gracefully and silently skipped
