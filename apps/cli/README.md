# @roo-code/cli

Command Line Interface for Roo Code - Run the Roo Code agent from the terminal without VSCode.

## Overview

This CLI uses the `@roo-code/vscode-shim` package to provide a VSCode API compatibility layer, allowing the main Roo Code extension to run in a Node.js environment.

## Installation

```bash
# From the monorepo root.
pnpm install

# Build the main extension first.
pnpm --filter roo-cline bundle

# Build the cli.
pnpm --filter @roo-code/cli build
```

## Usage

### Interactive Mode (Default)

By default, the CLI prompts for approval before executing actions:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...

pnpm --filter @roo-code/cli start \
  -x \
  -p openrouter \
  -k $OPENROUTER_API_KEY \
  -m anthropic/claude-sonnet-4.5 \
  --workspace ~/Documents/my-project \
  "What is this project?"
```

In interactive mode:

- Tool executions prompt for yes/no approval
- Commands prompt for yes/no approval
- Followup questions show suggestions and wait for user input
- Browser and MCP actions prompt for approval

### Non-Interactive Mode (`-y`)

For automation and scripts, use `-y` to auto-approve all actions:

```bash
pnpm --filter @roo-code/cli start \
  -y \
  -x \
  -p openrouter \
  -k $OPENROUTER_API_KEY \
  -m anthropic/claude-sonnet-4.5 \
  --workspace ~/Documents/my-project \
  "Refactor the utils.ts file"
```

In non-interactive mode:

- Tool, command, browser, and MCP actions are auto-approved
- Followup questions show a 10-second timeout, then auto-select the first suggestion
- Typing any key cancels the timeout and allows manual input

## Options

| Option                            | Description                                                                    | Default           |
| --------------------------------- | ------------------------------------------------------------------------------ | ----------------- |
| `-w, --workspace <path>`          | Workspace path to operate in                                                   | Current directory |
| `-e, --extension <path>`          | Path to the extension bundle directory                                         | Auto-detected     |
| `-v, --verbose`                   | Enable verbose output (show VSCode and extension logs)                         | `false`           |
| `-d, --debug`                     | Enable debug output (includes detailed debug information, prompts, paths, etc) | `false`           |
| `-x, --exit-on-complete`          | Exit the process when task completes (useful for testing)                      | `false`           |
| `-y, --yes`                       | Non-interactive mode: auto-approve all actions                                 | `false`           |
| `-k, --api-key <key>`             | API key for the LLM provider                                                   | From env var      |
| `-p, --provider <provider>`       | API provider (anthropic, openai, openrouter, etc.)                             | `openrouter`      |
| `-m, --model <model>`             | Model to use                                                                   | Provider default  |
| `-M, --mode <mode>`               | Mode to start in (code, architect, ask, debug, etc.)                           | `code`            |
| `-r, --reasoning-effort <effort>` | Reasoning effort level (none, minimal, low, medium, high, xhigh)               | `medium`          |

By default, the CLI runs in quiet mode (suppressing VSCode/extension logs) and only shows assistant output. Use `-v` to see all logs, or `-d` for detailed debug information.

## Environment Variables

The CLI will look for API keys in environment variables if not provided via `--api-key`:

| Provider      | Environment Variable |
| ------------- | -------------------- |
| anthropic     | `ANTHROPIC_API_KEY`  |
| openai        | `OPENAI_API_KEY`     |
| openrouter    | `OPENROUTER_API_KEY` |
| google/gemini | `GOOGLE_API_KEY`     |
| mistral       | `MISTRAL_API_KEY`    |
| deepseek      | `DEEPSEEK_API_KEY`   |
| bedrock       | `AWS_ACCESS_KEY_ID`  |

## Architecture

```
┌─────────────────┐
│   CLI Entry     │
│   (index.ts)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ExtensionHost  │
│  (extension-    │
│   host.ts)      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐  ┌──────────┐
│vscode │  │Extension │
│-shim  │  │ Bundle   │
└───────┘  └──────────┘
```

## How It Works

1. **CLI Entry Point** (`index.ts`): Parses command line arguments and initializes the ExtensionHost

2. **ExtensionHost** (`extension-host.ts`):

    - Creates a VSCode API mock using `@roo-code/vscode-shim`
    - Intercepts `require('vscode')` to return the mock
    - Loads and activates the extension bundle
    - Manages bidirectional message flow

3. **Message Flow**:
    - CLI → Extension: `emit("webviewMessage", {...})`
    - Extension → CLI: `emit("extensionWebviewMessage", {...})`

## Current Limitations

- **No TUI**: Output is plain text (no React/Ink UI yet)
- **No configuration file**: Settings are passed via command line flags
- **No persistence**: Each run is a fresh session

## Development

```bash
# Watch mode for development
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm check-types

# Linting
pnpm lint
```

## Troubleshooting

### Extension bundle not found

Make sure you've built the main extension first:

```bash
cd src
pnpm bundle
```

### Module resolution errors

The CLI expects the extension to be a CommonJS bundle. Make sure the extension's esbuild config outputs CommonJS.

### "vscode" module not found

The CLI intercepts `require('vscode')` calls. If you see this error, the module resolution interception may have failed.
