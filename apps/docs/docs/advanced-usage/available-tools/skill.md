---
description: Load and execute skill instructions using the skill tool for specialized tasks in Roo Code.
keywords:
    - skill
    - skills
    - specialized tasks
    - instructions
    - Roo Code tools
    - automation
    - workflows
---

# skill

The `skill` tool loads and injects specialized skill instructions into the conversation context. Skills provide detailed, step-by-step guidance for specific tasks like creating MCP servers, custom modes, or following standardized workflows.

---

## Parameters

The tool accepts these parameters:

- `skill` (required): The name of the skill to load (e.g., `create-mcp-server`, `create-mode`). Must match a skill name from the available skills list.
- `args` (optional): Additional context or arguments to pass to the skill for customization.

---

## What It Does

This tool retrieves skill instructions from the skills directory and loads them into the active conversation. Skills are pre-written instruction sets that guide Roo through complex, multi-step procedures. The tool is mode-aware, loading skills specific to the current mode when available.

---

## When is it used?

- When executing specialized procedures that have standardized workflows
- When creating MCP servers, custom modes, or other structured artifacts
- When following documented best practices for specific task types
- When you need to invoke expert knowledge for a particular domain
- When the task matches a known skill pattern available in the system

---

## Key Features

- Mode-aware skill resolution (loads mode-specific skills when available)
- Supports project-level skill overrides (take precedence over global skills)
- Progressive disclosure: linked files are not auto-loaded (explicit reads required)
- Optional arguments for skill customization
- Skills persist in context for the duration of the conversation
- Provides structured, step-by-step guidance for complex tasks

---

## How It Works

When the `skill` tool is invoked, it follows this process:

1. **Skill Resolution**: Searches for the named skill in the following locations (highest priority first):
    - Project `.roo` mode-specific (e.g., `.roo/skills-code/`)
    - Project `.roo` generic (`.roo/skills/`)
    - Project `.agents` mode-specific (e.g., `.agents/skills-code/`)
    - Project `.agents` generic (`.agents/skills/`)
    - Global `.roo` mode-specific (e.g., `~/.roo/skills-code/`)
    - Global `.roo` generic (`~/.roo/skills/`)
    - Global `.agents` mode-specific (e.g., `~/.agents/skills-code/`)
    - Global `.agents` generic (`~/.agents/skills/`)
2. **Skill Loading**: Loads the skill's main instruction file (typically `SKILL.md`).
3. **Context Injection**: Injects skill instructions into conversation context.
4. **Linked Files**: Files referenced in the skill are **not** automatically loaded; Roo must explicitly read them if needed.
5. **Execution**: Roo follows the skill's instructions to complete the task.

---

## Available Skills

Skills are dynamically loaded based on the current mode and project configuration. Common skills include:

- `create-mcp-server`: Guide for creating Model Context Protocol servers
- `create-mode`: Guide for creating custom Roo Code modes
- `find-skills`: Helps discover and install agent skills

To see available skills, check the skills list in the system prompt or ask Roo "what skills are available?"

---

## Relation to Features

The `skill` tool is the programmatic interface to the [Skills](/features/skills) feature. For comprehensive documentation on how skills work, how to create custom skills, and the skills system architecture, see the [Skills feature documentation](/features/skills).

---

## Example Usage

Loading a skill to create an MCP server:

```
<skill>
  <skill>create-mcp-server</skill>
  <args>weather API integration</args>
</skill>
```

Loading a skill without additional context:

```
<skill>
  <skill>create-mode</skill>
</skill>
```
