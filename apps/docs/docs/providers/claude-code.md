---
sidebar_label: Claude Code
description: Access Claude AI models through the official CLI in Roo Code. No API keys needed, supports advanced reasoning and transparent cost tracking.
keywords:
    - claude code
    - claude cli
    - roo code
    - api provider
    - claude max
    - no api key
    - claude reasoning
    - claude thinking mode
image: /img/social-share.jpg
---

# Claude Code Provider

The Claude Code provider allows you to use Anthropic's Claude models through their official CLI (Command Line Interface) instead of the web API. This provides direct access to your Claude Max subscription right from Roo Code.

:::info Setup Instructions
Before using the Claude Code provider, ensure you have completed the following steps:

1.  **Install Claude CLI**: Download and install the official command-line tool from [Anthropic's documentation](https://docs.anthropic.com/en/docs/claude-code/setup).
2.  **Authenticate**: Run `claude` in your terminal to start the application. Once the application is running, type `/login` to sign in to your Anthropic account. This step is required to grant Roo Code access to your Claude subscription.
3.  **Verify Setup**: Confirm the CLI is working by running `claude --version`. This ensures that Roo Code can find and use the executable.
4.  **Configure in Roo Code**:
    - Go to Roo Code settings and select **"Claude Code"** as your API provider.
    - If you installed the CLI in a custom location, set the **"Claude Code Path"** to the full executable path (e.g., `/usr/local/bin/claude`). Otherwise, you can leave it blank.
    - Choose your desired model from the list of available options.

Once configured, Roo Code will use your local Claude CLI installation to interact with Anthropic's models, leveraging your existing subscription.
:::

:::warning Environment Variable Usage
The `claude` command-line tool, like other Anthropic SDKs, can use the `ANTHROPIC_API_KEY` environment variable for authentication. This is a common method for authorizing CLI tools in non-interactive environments.

If this environment variable is set on your system, the `claude` tool may use it for authentication instead of the interactive `/login` method. When Roo Code executes the tool, it will accurately reflect that an API key is being used, as this is the underlying behavior of the `claude` CLI itself.
:::

**Website:** [https://docs.anthropic.com/en/docs/claude-code/setup](https://docs.anthropic.com/en/docs/claude-code/setup)

---

## Key Features

- **Direct CLI Access**: Uses Anthropic's official Claude CLI tool for model interactions.
- **Advanced Reasoning**: Full support for Claude's thinking mode and reasoning capabilities.
- **Cost Transparency**: Shows exact usage costs as reported by the CLI.
- **Flexible Configuration**: Works with your existing Claude CLI setup.

---

## Why Use This Provider

- **No API Keys**: Uses your existing Claude CLI authentication.
- **Cost Benefits**: Leverage CLI subscription rates and transparent cost reporting.
- **Latest Features**: Access new Claude capabilities as they're released in the CLI.
- **Advanced Reasoning**: Full support for Claude's thinking modes.

## How it Works

The Claude Code provider works by:

1. **Running Commands**: Executes the `claude` CLI command with your prompts.
2. **Processing Output**: Handles the CLI's JSON output in chunks with advanced parsing.
3. **Handling Reasoning**: Captures and displays Claude's thinking process when available.
4. **Tracking Usage**: Reports token usage and costs as provided by the CLI.

The provider integrates with Roo Code's interface, giving you the same experience as other providers while using the Claude CLI under the hood.

---

## Configuration

### **Claude Code Path**

- **Setting**: `claudeCodePath`
- **Description**: Path to your Claude CLI executable.
- **Default**: `claude` (assumes it's in your system PATH).
- **When to change**: If you installed Claude CLI in a custom location.

**Example custom paths:**

- macOS/Linux: `/usr/local/bin/claude` or `~/bin/claude`

### **Max Output Tokens**

- **Default**: 16,384 tokens (16k) - increased from previous 8k default
- **Environment Variable**: `CLAUDE_CODE_MAX_OUTPUT_TOKENS`
- **Description**: Controls the maximum number of tokens Claude can generate in a single response.
- **When to change**: If you need longer responses or want to limit output length for cost/performance reasons.

**Example configuration:**

```bash
export CLAUDE_CODE_MAX_OUTPUT_TOKENS=32768  # Set to 32k tokens
```

---

## Supported Models

The Claude Code provider supports these Claude models:

- **Claude Opus 4.1** (Most capable)
- **Claude Opus 4**
- **Claude Sonnet 4** (Latest, recommended)
- **Claude 3.7 Sonnet**
- **Claude 3.5 Sonnet**
- **Claude 3.5 Haiku** (Fast responses)

The specific models available depend on your Claude CLI subscription and plan.

---

## Output Token Limits

The Claude Code provider now defaults to 16,384 (16k) max output tokens, allowing for longer and more complete responses. This is particularly useful for:

- Generating large code files
- Detailed explanations and documentation
- Complex refactoring operations
- Multi-file changes

You can customize this limit using the `CLAUDE_CODE_MAX_OUTPUT_TOKENS` environment variable if you need different limits for your use case.

---

## Common Questions

**"Do I need a Claude API key for this provider?"**

- Typically no. You can authenticate interactively using the `/login` command within the `claude` application.
- However, if the `ANTHROPIC_API_KEY` environment variable is set, the Claude CLI may use it for authentication. See the warning above for details.

**"How do I install the Claude CLI?"**

- Visit [Anthropic's CLI documentation](https://docs.anthropic.com/en/docs/claude-code/setup) for installation instructions
- The CLI handles its own authentication and setup

**"Why would I use this instead of the regular Anthropic provider?"**

- Potential cost benefits depending on your subscription

**"What if the CLI isn't in my PATH?"**

- Set a custom path in the Claude Code Path setting
- Point to the full path where you installed the CLI
