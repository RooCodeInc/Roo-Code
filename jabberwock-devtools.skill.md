---
name: Jabberwock DevTools
description: Interactive DevTools capabilities for controlling the UI and introspecting the Jabberwock state
modes: [architect, code, test]
---

# Jabberwock DevTools Skill

This skill provides powerful tools for inspecting and interacting with the Jabberwock extension using its built-in DevTools MCP Server.

## Features

### 1. Diagnostic Log Inspection

Jabberwock exports all console logs, state patch changes, and internal milestones to a physical file.

- **Path**: `~/.config/Code/User/globalStorage/mikita_dusmikeev.jabberwock/jabberwock.diagnostics.log` (typical path on Mac/Linux) or you can use the MCP server directly.
- **Tool**: You can configure the `Jabberwock DevTools` MCP Server locally via MCP options. Or use the specific tools if mounted.
- Use the MCP `read_diagnostics` tool to quickly view the tail end of the log without messy CLI commands.

### 2. State Introspection

The entire application state tree is exported dynamically to the DOM when DevTools is enabled.

- To use, use Playwright to execute a script `window.__JABBERWOCK_GET_STATE__()` in the main iframe context. This gives you structured access to active settings, task IDs, and current application state.

### 3. UI Automation (MCP)

Instead of relying strictly on frail UI locators, interact directly with the underlying Jabberwock Extension API through the `Jabberwock DevTools` MCP server.

- **Tool `interact_with_ui`**: Accepts `{"action": "continue"}` or `{"action": "cancel"}`. This triggers exactly the same internal event pipeline as if a user pressed the Continue or Cancel buttons in the UI.

### 4. Semantic UI Locators

If you need to automate via Playwright (e.g. for e2e tests), always target these specific `data-agent-action` attributes which are guaranteed stable:

- `data-agent-action="chat-input"`: The main text area
- `data-agent-action="continue-task"`: The primary action button (e.g. Continue/Approve)
- `data-agent-action="reject-task"`: The secondary action button (e.g. Reject/Cancel)
- `data-agent-action="mode-select"`: The mode selector combobox
- `data-agent-action="send-message"` / `data-agent-action="cancel-task"`: The right-hand send/stop action button.

## Setup Instructions

To connect to the DevTools MCP server, configure your MCP settings to connect over SSE to the port allocated by the extension (printed in the VS Code Output -> Jabberwock logs when devtool is enabled).

```json
{
	"mcpServers": {
		"jabberwock-devtools": {
			"type": "sse",
			"url": "http://127.0.0.1:<PORT>/sse"
		}
	}
}
```
