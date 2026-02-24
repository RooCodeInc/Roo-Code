---
"roo-cline": patch
---

Re-add lightweight MCP servers section to system prompt for better OpenAI/ChatGPT compatibility

When MCP tools were migrated to native tool definitions (PR #10895), the MCP SERVERS section was removed from the system prompt. While Claude and Gemini models can infer MCP tool usage from native tool definitions alone, OpenAI models need additional context to understand the `mcp--serverName--toolName` naming convention. This adds back a lightweight section that lists connected MCP servers, their tool name mappings, server-specific instructions, and explains the naming convention -- without duplicating tool schemas that are already in the native tool definitions.
