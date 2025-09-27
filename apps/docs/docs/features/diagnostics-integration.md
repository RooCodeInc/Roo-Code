---
description: Leverage Roo Code's integration with VSCode's Problems panel to automatically detect, understand, and fix code errors, warnings, and linting issues.
keywords:
    - diagnostics integration
    - error detection
    - problems panel
    - code fixes
    - linting
    - language server
    - automatic error fixing
image: /img/social-share.jpg
---

# Diagnostics Integration

Roo Code provides intelligent integration with VSCode's Problems panel, allowing the AI assistant to understand and help fix code errors, warnings, and other issues detected by language servers, linters, and other diagnostic providers.

---

## Overview

The diagnostics feature seamlessly integrates with VSCode's diagnostic system to provide context-aware assistance for code issues. When you make edits or encounter problems in your code, Roo Code can automatically detect and help resolve them.

### Key Capabilities

- **Automatic Error Detection**: Captures new errors introduced during code edits
- **Context-Aware Fixes**: Provides targeted fixes based on diagnostic information
- **Workspace Problems Mention**: Access all workspace diagnostics through a simple mention
- **Smart Filtering**: Uses predefined severity levels for different contexts

---

## Key Features

### 1. Automatic Error Detection

When Roo Code makes edits to files, it automatically:

- Captures diagnostics before editing
- Waits for diagnostics to update after editing
- Detects new problems introduced by the changes
- Only reports new errors (not pre-existing ones)

This ensures you're immediately aware of any issues introduced by code changes, allowing for quick resolution.

### 2. Workspace Problems Mention

Users can include `@problems` in their messages to:

- Get a complete list of workspace errors and warnings
- Provide context for debugging tasks
- Request fixes for specific issues

Example usage:

```
@problems Fix all TypeScript errors in my project
```

For more details on using `@problems`, see [Context Mentions](/basic-usage/context-mentions#problems-mention).

### 3. Code Actions Integration

When diagnostics exist at a cursor position:

- "Fix with Roo Code" action appears in quick fix menu
- Includes diagnostic details in the fix request
- Provides targeted solutions based on error context

Learn more about this integration in [Code Actions](/features/code-actions#context-aware-actions).

### 4. Smart Severity Filtering

Different features use different severity filters to provide the most relevant information:

- **Workspace Problems mention**: Shows errors and warnings
- **Automatic detection**: Shows only errors (to avoid distraction)
- **Context-Aware**: Different features use different hardcoded severity filters

---

## Severity Levels

The diagnostics system recognizes four severity levels from VSCode:

| Level       | Value | Description                                         | Workspace Problems | Auto-detection  |
| ----------- | ----- | --------------------------------------------------- | ------------------ | --------------- |
| Error       | 0     | Syntax errors, type errors, breaking issues         | ✅ Included        | ✅ Included     |
| Warning     | 1     | Code quality issues, deprecations, style violations | ✅ Included        | ❌ Not included |
| Information | 2     | Suggestions, hints, informational messages          | ❌ Not included    | ❌ Not included |
| Hint        | 3     | Minor suggestions, refactoring opportunities        | ❌ Not included    | ❌ Not included |

### Why Different Filters?

- **Workspace Problems (`@problems`)**: Includes both errors and warnings to give you a complete picture of code health when explicitly requested
- **Automatic Detection**: Only includes errors to avoid interrupting your workflow with non-critical issues

---

## Using Diagnostics Effectively

### For Debugging Sessions

When starting a debugging session, include `@problems` to give Roo Code full context:

```
@problems Help me debug why my application is crashing
```

### For Code Reviews

Use diagnostics to ensure code quality:

```
@problems Review my code and fix any linting issues
```

### For Refactoring

Let diagnostics guide safe refactoring:

```
I want to refactor this function. @problems shows current issues to address.
```

---

## Integration with Other Features

### Code Actions

Diagnostics power the context-aware [Code Actions](/features/code-actions) that appear in VSCode's lightbulb menu. When errors are present, you'll see "Fix Code" options that include the specific diagnostic information.

### Context Mentions

The [`@problems` mention](/basic-usage/context-mentions#problems-mention) provides a convenient way to include all workspace diagnostics in your conversation without manually copying error messages.

### Automatic Error Reporting

When Roo Code edits files, any new errors introduced are automatically reported in the response, helping maintain code quality throughout the editing process.

---

## Best Practices

1. **Use `@problems` for Context**: When debugging, always include `@problems` to give Roo Code full visibility into current issues

2. **Address Errors First**: Focus on fixing errors before warnings, as errors typically prevent code from running

3. **Leverage Code Actions**: Use the quick fix menu for targeted fixes to specific diagnostics

4. **Monitor Auto-Detection**: Pay attention to new errors reported after edits to catch issues early

5. **Combine with Other Tools**: Use diagnostics alongside other Roo Code features like codebase search and file mentions for comprehensive problem-solving

---

## Troubleshooting

### Diagnostics Not Appearing

- Ensure your language server or linter is properly configured and running
- Check that the file type is supported by your diagnostic providers
- Verify that VSCode's Problems panel shows the issues

### `@problems` Shows Nothing

- Confirm there are actually problems in the Problems panel
- Check that you're in the correct workspace
- Some diagnostic providers may take time to initialize

### Auto-Detection Missing Errors

- Only new errors (introduced by edits) are reported
- Pre-existing errors won't be shown in auto-detection
- Use `@problems` to see all current issues

---

## Related Features

- [Context Mentions](/basic-usage/context-mentions) - Learn about all mention types including `@problems`
- [Code Actions](/features/code-actions) - Discover how diagnostics integrate with quick fixes
- [Codebase Search](/features/codebase-indexing) - Find code related to specific errors
