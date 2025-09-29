---
description: Discover recommended MCP servers for Roo Code, including Context7. Learn how to install and configure MCP servers with step-by-step instructions.
keywords:
    - MCP servers
    - Context7
    - Roo Code MCP
    - MCP installation
    - MCP configuration
    - recommended servers
image: /img/social-share.jpg
sidebar_label: Recommended MCP Servers
---

# Recommended MCP Servers

While Roo Code can connect to any Model Context Protocol (MCP) server that follows the specification, the community has already built several high-quality servers that work out-of-the-box. This page curates the servers we **actively recommend** and provides step-by-step setup instructions so you can get productive in minutes.

> We'll keep this list up-to-date. If you maintain a server you'd like us to consider, please open a pull-request.

---

## Context7

`Context7` is our first-choice general-purpose MCP server. It ships a collection of highly-requested tools, installs with a single command, and has excellent support across every major editor that speaks MCP.

### Why we recommend Context7

- **One-command install** – everything is bundled, no local build step.
- **Cross-platform** – runs on macOS, Windows, Linux, or inside Docker.
- **Actively maintained** – frequent updates from the Upstash team.
- **Rich toolset** – database access, web-search, text utilities, and more.
- **Open source** – released under the MIT licence.

---

## Installing Context7 in Roo Code

There are two common ways to register the server:

1. **Global configuration** – available in every workspace.
2. **Project-level configuration** – checked into version control alongside your code.

We'll cover both below.

### 1. Global configuration

1. Open the Roo Code **MCP settings** panel by clicking the <Codicon name="server" /> icon.
2. Click **Edit Global MCP**.
3. Paste the JSON below inside the `mcpServers` object and save.

```json
{
	"mcpServers": {
		"context7": {
			"command": "npx",
			"args": ["-y", "@upstash/context7-mcp@latest"]
		}
	}
}
```

**Windows (cmd.exe) variant**

```json
{
	"mcpServers": {
		"context7": {
			"type": "stdio",
			"command": "cmd",
			"args": ["/c", "npx", "-y", "@upstash/context7-mcp@latest"]
		}
	}
}
```

Also on **Windows (cmd)** you may need to invoke `npx` through `cmd.exe`:

<img src="/img/recommended-mcp-servers/context7-global-setup-fixed.png" alt="Adding Context7 to the global MCP settings" width="600" />

### 2. Project-level configuration

If you prefer to commit the configuration to your repository, create a file called `.roo/mcp.json` at the project root and add the same snippet:

```json
{
	"mcpServers": {
		"context7": {
			"command": "npx",
			"args": ["-y", "@upstash/context7-mcp@latest"]
		}
	}
}
```

**Windows (cmd.exe) variant**

```json
{
	"mcpServers": {
		"context7": {
			"type": "stdio",
			"command": "cmd",
			"args": ["/c", "npx", "-y", "@upstash/context7-mcp@latest"]
		}
	}
}
```

<img src="/img/recommended-mcp-servers/context7-project-setup-fixed.png" alt="Adding Context7 to a project-level MCP file" width="600" />

> When both global and project files define a server with the same name, **the project configuration wins**.

---

## Verifying the installation

1. Make sure **Enable MCP Servers** is turned on in the MCP settings panel.
2. You should now see **Context7** listed. Click the <Codicon name="activate" /> toggle to start it if it isn't already running.
3. Roo Code will prompt you the first time a Context7 tool is invoked. Approve the request to continue.

<img src="/img/recommended-mcp-servers/context7-running-fixed.png" alt="Context7 running in Roo Code" width="400" />

---

## Next steps

- Browse the list of tools shipped with Context7 in the server pane.
- Configure **Always allow** for the tools you use most to streamline your workflow.
- Want to expose your own APIs? Check out the [MCP server creation guide](/features/mcp/using-mcp-in-roo#enabling-or-disabling-mcp-server-creation).

Looking for other servers? Watch this page – we'll add more recommendations soon!
