---
"roo-code": minor
---

Added support for VS Code variable interpolation in Provider Custom Headers. Users can now use `${workspaceFolderBasename}`, `${workspaceFolder}`, and `${env:VAR_NAME}` patterns in custom header values, enabling per-project tracking and routing without creating multiple provider profiles.
