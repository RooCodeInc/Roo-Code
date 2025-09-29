---
description: Execute predefined slash commands that provide templated instructions for common tasks, with support for built-in, global, and project-specific commands in Roo Code.
keywords:
    - run_slash_command
    - slash commands
    - command templates
    - Roo Code tools
    - workflow automation
    - instruction templates
    - custom commands
    - experimental feature
image: /img/social-share.jpg
---

# run_slash_command

:::warning Experimental Feature
The `run_slash_command` tool is an experimental feature that must be explicitly enabled in settings. Navigate to Settings > Experimental Settings and enable "Run Slash Command" to use this tool.
:::

The `run_slash_command` tool executes predefined slash commands to retrieve specific instructions or content templates. These commands act as reusable instruction sets for common tasks, providing detailed guidance that Roo can interpret and execute. Commands can be defined at three levels with a clear priority hierarchy: project > global > built-in.

---

## Parameters

The tool accepts these parameters:

- `command` (required): Name of the slash command to execute (without the leading slash)
- `args` (optional): Additional arguments or context to pass to the command

---

## What It Does

This tool retrieves and executes instruction templates defined as markdown files in command directories. It enables standardized workflows, reusable task instructions, and team-wide consistency through shared command templates. The tool validates experimental flag status, resolves commands through the priority hierarchy, and returns formatted instructions for Roo to interpret.

---

## When is it used?

- When executing standardized workflows that require consistent steps
- When retrieving project-specific or team-wide instruction templates
- When initializing codebases with analysis and documentation
- When accessing complex multi-step processes as single commands
- When maintaining consistency across team development practices

---

## Key Features

- **Three-Level Command System**: Built-in, global (~/.roo/commands/), and project-specific (.roo/commands/) commands
- **Priority Hierarchy**: Project commands override global, which override built-in commands
- **Markdown-Based Templates**: Simple `.md` files with optional YAML frontmatter for metadata
- **Dynamic Arguments**: Pass context-specific arguments to customize command execution
- **Automatic Discovery**: Commands are automatically found from their respective directories
- **Safe Execution**: Commands are text-only instructions requiring user approval, not executable code
- **Metadata Support**: Optional frontmatter for descriptions and argument hints
- **Error Recovery**: Graceful handling with helpful error messages and command suggestions
- **No Registration Required**: Simply place `.md` files in command directories

---

## Requirements

This tool requires explicit enablement:

1. Open VS Code Settings
2. Navigate to Experimental Settings
3. Enable "Run Slash Command"
4. Restart VS Code if necessary

---

## Limitations

- **Experimental Status**: Feature is disabled by default and requires opt-in
- **Text-Only Instructions**: Commands provide instructions, not direct code execution
- **Approval Required**: All command executions require user approval
- **Directory-Based**: Commands must be in specific directory locations
- **Case-Sensitive**: Command names are matched with case sensitivity
- **Single Command**: Can only execute one command per tool invocation

---

## How It Works

When the `run_slash_command` tool is invoked, it follows this process:

1. **Experimental Flag Validation**:

    - Checks if the `runSlashCommand` experiment is enabled
    - Returns descriptive error if feature is disabled
    - Provides instructions for enabling the feature

2. **Parameter Processing**:

    - Validates the required `command` parameter
    - Captures optional `args` for command customization
    - Increments mistake counter for missing parameters

3. **Command Resolution**:

    - Searches project directory first (`.roo/commands/`)
    - Falls back to global directory (`~/.roo/commands/`)
    - Finally checks built-in commands
    - Returns undefined if command doesn't exist

4. **Command Loading**:

    - Reads the markdown file for the command
    - Parses optional YAML frontmatter using `gray-matter`
    - Extracts description and argument hints if present
    - Returns command content without frontmatter

5. **Response Formatting**:

    - Includes command name and source location
    - Adds description and argument hints if available
    - Shows provided arguments for context
    - Returns the full command content for interpretation

6. **Error Handling**:
    - Lists available commands if requested command not found
    - Provides helpful error messages with alternatives
    - Tracks consecutive mistakes for error patterns

---

## Command Structure

### File Format

Commands are markdown files placed in designated directories:

```markdown
---
description: Brief description of what this command does
argument-hint: What arguments this command accepts
---

# Command Content

Detailed instructions for the task go here.
This can include:

- Step-by-step procedures
- Code templates
- Configuration examples
- Best practices
```

### Naming Convention

- File name becomes the command name
- Use `.md` extension
- Example: `deploy.md` creates `/deploy` command
- Case-sensitive matching

### Directory Locations

1. **Built-in Commands**: Hardcoded in source code
2. **Global Commands**: `~/.roo/commands/`
3. **Project Commands**: `<project-root>/.roo/commands/`

---

## Built-in Commands

### /init Command

The only current built-in command analyzes your codebase and creates documentation:

- Analyzes project structure and architecture
- Creates AGENTS.md documentation files
- Identifies coding patterns and conventions
- Documents non-obvious implementation details
- Provides AI-friendly project context

---

## Creating Custom Commands

### Step-by-Step Guide

1. **Create Command Directory**:

    ```bash
    # For project-specific commands
    mkdir -p .roo/commands

    # For global commands
    mkdir -p ~/.roo/commands
    ```

2. **Create Command File**:

    ```bash
    # Create a deployment command
    touch .roo/commands/deploy.md
    ```

3. **Add Command Content**:

    ```markdown
    ---
    description: Deploy application to production environment
    argument-hint: environment name (staging, production)
    ---

    ## Deployment Process

    1. Run test suite to ensure all tests pass
    2. Build production bundle with optimizations
    3. Update environment variables for target
    4. Deploy to specified environment
    5. Run post-deployment health checks
    6. Update deployment documentation
    ```

4. **Use the Command**:
   The command is immediately available for use without registration.

---

## Command Priority System

When multiple commands with the same name exist:

1. **Project Level** (highest priority)

    - Located in `.roo/commands/`
    - Allows project-specific overrides
    - Committed to version control for team sharing

2. **Global Level** (medium priority)

    - Located in `~/.roo/commands/`
    - Shared across all projects
    - User-specific customizations

3. **Built-in Level** (lowest priority)
    - Hardcoded in the extension
    - Provides default functionality
    - Always available as fallback

---

## Examples When Used

- When initializing a new project, Roo executes `/init` to analyze the codebase structure and create comprehensive documentation.
- When deploying applications, Roo retrieves standardized deployment instructions specific to the project's infrastructure.
- When implementing features, Roo accesses team-agreed patterns and best practices through custom commands.
- When setting up development environments, Roo follows project-specific setup instructions consistently.
- When performing code reviews, Roo uses standardized review checklists defined as commands.

---

## Usage Examples

Executing the built-in initialization command:

```xml
<run_slash_command>
<command>init</command>
</run_slash_command>
```

Running a custom deployment command with arguments:

```xml
<run_slash_command>
<command>deploy</command>
<args>production environment with zero-downtime strategy</args>
</run_slash_command>
```

Executing a test command with specific focus:

```xml
<run_slash_command>
<command>test</command>
<args>focus on integration tests for authentication module</args>
</run_slash_command>
```

Running a project-specific build command:

```xml
<run_slash_command>
<command>build</command>
<args>optimized for production with source maps</args>
</run_slash_command>
```

Accessing team coding standards:

```xml
<run_slash_command>
<command>standards</command>
<args>TypeScript and React best practices</args>
</run_slash_command>
```

---

## Best Practices

### Command Design

1. **Clear Naming**: Use descriptive, action-oriented names
2. **Comprehensive Instructions**: Include all necessary steps
3. **Argument Flexibility**: Design commands to work with or without arguments
4. **Metadata Usage**: Always include description and argument hints
5. **Version Control**: Commit project commands for team consistency

### Organization Strategies

1. **Categorization**: Group related commands with prefixes (e.g., `test-unit`, `test-integration`)
2. **Documentation**: Maintain a README in command directories
3. **Templates**: Create template commands for common patterns
4. **Overrides**: Use project-level to customize global commands
5. **Maintenance**: Regularly review and update command content

### Team Collaboration

1. **Standardization**: Define team-wide commands in global directory
2. **Project Specifics**: Override with project-level customizations
3. **Documentation**: Document available commands and their usage
4. **Review Process**: Include command changes in code reviews
5. **Training**: Share command knowledge across team members

---

## Troubleshooting

### Common Issues

**Feature Not Enabled**:

- Error: "Run slash command is an experimental feature that must be enabled in settings"
- Solution: Enable 'Run Slash Command' in Experimental Settings

**Command Not Found**:

- Error: "Command 'X' not found. Available commands: Y, Z"
- Solution: Check command name spelling and available commands list

**Missing Parameters**:

- Error tracked in consecutive mistake counter
- Solution: Provide required `command` parameter

### Debugging Commands

1. **Verify File Location**: Ensure `.md` file is in correct directory
2. **Check File Name**: Command name must match filename without extension
3. **Validate Frontmatter**: Ensure YAML frontmatter is properly formatted
4. **Test Resolution**: Try same command name at different levels to test priority
5. **Review Content**: Ensure command content is properly formatted markdown
