---
"roo-cline": patch
---

Fix duplicate MCP tools error when same server is defined in global and project configs

When the same MCP server (e.g., "context7") was defined in both global and project configs, the getMcpServerTools() function generated duplicate tool definitions with the same name, causing API errors like "The tool mcp--context7--resolve-library-id is already defined".

Added deduplication logic to getMcpServerTools() using a Set to track seen tool names. First occurrence wins (project servers take priority over global servers).

Fixes: https://roo-code.sentry.io/issues/7111443956/
