# Oncall Workflow Overview

This directory contains workflow files that are automatically loaded when using the Oncall mode. These workflows provide structured guidance for handling various oncall scenarios.

## Adding Your Workflows

Workflows should be placed in `.roo/rules-oncall/`. Create markdown files for each workflow you need:

- Incident response procedures
- Page handling workflows
- Escalation procedures
- Service-specific runbooks (in `service-specific/` subdirectory)

## Workflow Structure

Each workflow should follow a clear structure:

1. **Initial Assessment** - Understand the situation
2. **Action Plan** - Determine next steps
3. **Execution** - Follow the plan using MCP tools
4. **Documentation** - Record actions taken
5. **Resolution** - Confirm resolution and update status

## Using Workflows

When handling an oncall task:

1. Identify which workflow applies to your situation
2. Read the workflow file from `.roo/rules-oncall/`
3. Follow the steps sequentially
4. Use MCP tools as specified in the workflow
5. Document all actions in incident logs

## MCP Tools

Workflows can reference MCP tools using the `use_mcp_tool` pattern. Configure your MCP servers and reference them in your workflow files.
