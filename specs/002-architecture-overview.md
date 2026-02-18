# SPEC-002: Architecture Overview

## Architectural Requirement

Strict privilege separation MUST be enforced.

## Layers

### Webview (UI)

- Restricted presentation layer.
- Emits events via `postMessage`.

### Extension Host (Logic)

- Handles API polling.
- Manages secrets and configuration.
- Executes tools and orchestrates agent flow.

### Hook Engine (Middleware Boundary)

- Intercepts all tool execution requests.
- Enforces deterministic governance rules.
- MUST include native tools, dynamic MCP (`mcp_tool_use`), and custom-tool execution paths.

## Hook Responsibilities

### PreToolUse

- Enforce active intent context.
- Enforce Human-in-the-Loop for destructive actions.
- Enforce scope and stale-write checks.

### PostToolUse

- Update mutation trace state.
- Update intent evolution map.
- Update living documentation signals.
