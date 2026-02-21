# System Prompt Architecture

## Overview

The Roo-Code system prompt is generated through a sophisticated multi-step process that combines multiple specialized sections to create a comprehensive AI agent configuration. The architecture is designed to be highly configurable, extensible, and adaptable to different modes, projects, and user preferences.

## Core Architecture

### Entry Point: `SYSTEM_PROMPT` Function

**Location**: `src/core/prompts/system.ts`

The main entry point accepts comprehensive parameters:

- Extension context and working directory
- MCP hub for tool integration
- Mode configuration (default: "code")
- Custom instructions and settings
- Skills manager for mode-specific capabilities

### Generation Flow

1. **Mode Processing**: Determines active mode and retrieves appropriate role definition
2. **Section Assembly**: Combines multiple specialized sections
3. **Customization**: Integrates user-defined rules and preferences
4. **Output**: Returns complete system prompt string

## System Prompt Sections

### 1. Role Definition

- Sets the agent's primary role and responsibilities
- Retrieved from mode configuration
- Provides context for agent behavior

### 2. Markdown Formatting Rules

**Location**: `src/core/prompts/sections/markdown-formatting.ts`

Enforces clickable syntax for all code references:

```markdown
ALL responses MUST show ANY `language construct` OR filename reference as clickable, exactly as [`filename OR language.declaration()`](relative/file/path.ext:line)
```

### 3. Tool Use Section

**Location**: `src/core/prompts/sections/tool-use.ts`

Documents available tools and execution protocols:

- CLI command execution
- File operations (read, write, search)
- Code analysis and navigation
- MCP server integration

### 4. Tool Use Guidelines

**Location**: `src/core/prompts/sections/tool-use-guidelines.ts`

Provides step-by-step instructions for effective tool usage:

1. Assess available information
2. Choose appropriate tools
3. Execute iteratively with feedback
4. Use multiple tools when appropriate

### 5. Capabilities Section

**Location**: `src/core/prompts/sections/capabilities.ts`

Lists available tools and their purposes:

- File system operations
- Command execution
- Code analysis
- MCP server integration
- Environment information

### 6. Intent Protocol (NEW)

**Location**: `src/core/prompts/sections/intent-protocol.ts`

Enforces Intent-Driven Architect protocol:

- **Rule 1**: Intent declaration before code changes
- **Rule 2**: Scope enforcement within owned_scope
- **Rule 3**: Traceability with intent_id parameters
- **Rule 4**: Autonomous recovery from blocked operations

### 7. Modes Section

**Location**: `src/core/prompts/sections/modes.ts`

Lists available modes with descriptions:

- Built-in modes (code, architect, etc.)
- Custom mode configurations
- Mode-specific whenToUse descriptions

### 8. Skills Section

**Location**: `src/core/prompts/sections/skills.ts`

Includes mode-specific skills:

- XML-formatted skill definitions
- Skill applicability checks
- Progressive disclosure of linked files
- Override resolution for project-level skills

### 9. Rules Section

**Location**: `src/core/prompts/sections/rules.ts`

Contains project-specific constraints:

- File path restrictions
- Shell-specific command chaining
- Mode-specific file editing restrictions
- Vendor confidentiality (for stealth models)

### 10. System Information

**Location**: `src/core/prompts/sections/system-info.ts`

Provides environment context:

- Operating system details
- Shell configuration
- Directory structure
- Workspace information

### 11. Objective Section

**Location**: `src/core/prompts/sections/objective.ts`

Outlines task completion methodology:

1. Analyze task and set clear goals
2. Work through goals sequentially
3. Use tools methodically
4. Present results via attempt_completion
5. Handle feedback iteratively

### 12. Custom Instructions

**Location**: `src/core/prompts/sections/custom-instructions.ts`

Integrates user-defined rules from multiple sources:

- Mode-specific rules from `.roo/rules-{mode}/`
- Global rules from `.roo/rules/`
- Agent rules from `AGENTS.md`/`AGENT.md`
- Personal overrides from `AGENTS.local.md`
- Legacy support for `.roorules` and `.clinerules`

## Intent Protocol Deep Dive

### Protocol Enforcement

The Intent Protocol mandates strict adherence to intent-driven development:

```markdown
## INTENT-DRIVEN ARCHITECT PROTOCOL (MANDATORY)

You are an Intent-Driven Architect operating in a governed AI-Native IDE. You MUST follow this protocol for EVERY task:

### Rule 1: Intent Declaration (BEFORE any code changes)

1. Analyze the user request to identify the relevant business intent
2. Call `select_active_intent(intent_id)` with a valid ID from `.orchestration/active_intents.yaml`
3. Wait for the system to return `<intent_context>` with constraints and scope
4. ONLY after receiving intent context may you proceed with code changes
```

### Violation Consequences

| Violation                             | Consequence |
| ------------------------------------- | ----------- |
| Writing code without declaring intent | BLOCKED     |
| Editing out-of-scope files            | BLOCKED     |
| Missing intent_id in write_file       | BLOCKED     |

### Example Workflow

```bash
User: "Refactor the auth middleware for JWT"

You: select_active_intent("INT-001")  ← MUST DO THIS FIRST

System: <intent_context>
  <id>INT-001</id>
  <name>JWT Authentication Migration</name>
  <owned_scope>src/auth/**, src/middleware/jwt.ts</owned_scope>
  <constraints>Must not use external auth providers</constraints>
</intent_context>

You: [Now you can write code with full context]
write_file(path="src/auth/middleware.ts", intent_id="INT-001", mutation_class="AST_REFACTOR")
```

## Custom Instructions System

### Multi-Source Integration

The system supports rules from multiple sources with clear precedence:

1. **Mode-Specific Rules**: `.roo/rules-{mode}/` directories
2. **Global Rules**: `.roo/rules/` directories
3. **Agent Rules**: `AGENTS.md`/`AGENT.md` files
4. **Personal Overrides**: `AGENTS.local.md` files
5. **Legacy Files**: `.roorules` and `.clinerules`

### Recursive Discovery

When `enableSubfolderRules` is enabled:

- Searches all subdirectories with `.roo` folders
- Maintains alphabetical ordering for consistency
- Handles symbolic links and nested directories
- Filters out cache and system files

### File Processing

- **Symlink Resolution**: Properly handles symbolic links to files and directories
- **Recursive Reading**: Processes nested directory structures
- **Content Formatting**: Formats with clear path headers
- **Error Handling**: Gracefully handles missing or inaccessible files

## Skills Integration

### XML-Based Skill Definitions

Skills are defined in XML format with:

- `<name>`: Skill identifier
- `<description>`: Purpose and usage
- `<location>`: File path
- `<override>`: Project-level overrides

### Skill Applicability Checks

The system performs mandatory skill evaluation:

1. **Skill Evaluation**: Check user request against available skills
2. **Selection**: Choose most specific applicable skill
3. **Loading**: Load skill instructions before proceeding
4. **Execution**: Follow skill instructions precisely

### Progressive Disclosure

- Skills are loaded only when selected
- Linked files are not automatically loaded
- Model must explicitly request linked files based on relevance
- Prefer minimum necessary file reading

## Configuration Options

### Settings Integration

The system respects various configuration options:

- `enableSubfolderRules`: Controls recursive rule discovery
- `useAgentRules`: Enables/disables agent rules loading
- `isStealthModel`: Controls vendor confidentiality sections

### Shell-Specific Adaptations

- **Command Chaining**: Uses appropriate operators (`&&`, `;`) based on shell
- **Utility Selection**: Avoids Unix-specific tools on Windows shells
- **Path Handling**: Converts paths to appropriate format

## Architecture Benefits

### Extensibility

- Modular section design allows easy addition of new components
- Plugin architecture for custom modes and skills
- Flexible rule system supports various project structures

### Governance

- Intent Protocol ensures controlled development
- File restrictions prevent unauthorized modifications
- Traceability requirements maintain audit trails

### Adaptability

- Mode-specific configurations for different use cases
- Custom instructions support project-specific requirements
- Multi-shell compatibility for diverse environments

### Maintainability

- Clear separation of concerns across sections
- Comprehensive error handling and fallbacks
- Well-documented interfaces and configurations

## Usage Patterns

### Development Workflow

1. **Intent Selection**: Always start with intent declaration
2. **Context Analysis**: Review system prompt sections for constraints
3. **Tool Selection**: Choose appropriate tools based on task requirements
4. **Execution**: Follow step-by-step guidelines
5. **Verification**: Ensure compliance with all rules and protocols

### Customization

1. **Mode Configuration**: Define custom modes with specific rules
2. **Skill Development**: Create XML-based skill definitions
3. **Rule Management**: Organize rules in `.roo` directories
4. **Agent Guidelines**: Document project-specific practices in `AGENTS.md`

This architecture provides a robust foundation for AI-assisted development while maintaining strict governance and adaptability to diverse project requirements.
