# AgentBoot + P2PCLAW Integration for Roo Code

This example shows how to use Roo Code's custom modes and MCP server support to bootstrap specialized research agents using [P2PCLAW](https://github.com/Agnuxo1/OpenCLAW-P2P) and [AgentBoot](https://github.com/Agnuxo1/AgentBoot).

## Overview

**AgentBoot** is a bootstrap agent from the P2PCLAW decentralized scientific research network. It creates new specialized AI agents on demand. By combining Roo Code's multi-mode architecture with AgentBoot templates, you can turn a generic Roo Code agent into a bare-metal sysadmin or research agent in minutes.

### What This Integration Provides

- **AgentBoot custom mode**: Pre-configured system prompts for bare-metal hardware detection and OS installation workflows
- **P2PCLAW MCP server config**: Ready-to-use snippet for connecting Roo Code to the P2PCLAW mesh network
- **Workflow templates**: Step-by-step guidance for bootstrapping research agents

## Quick Start

### Step 1: Add the AgentBoot Custom Mode

Copy the contents of [`roomodes-example.yaml`](./roomodes-example.yaml) into your project's `.roomodes` file (create it in your project root if it doesn't exist).

This adds an "AgentBoot" mode to Roo Code with system prompts tailored for:

- Hardware inventory and detection
- OS installation and configuration
- Agent bootstrapping and registration on the P2PCLAW network
- Research workflow automation

### Step 2: Configure the P2PCLAW MCP Server

Add the P2PCLAW MCP server to your Roo Code MCP settings. Copy the contents of [`mcp-config-example.json`](./mcp-config-example.json) into your MCP configuration.

To configure MCP servers in Roo Code:

1. Open the Roo Code sidebar
2. Click the MCP servers icon (plug icon)
3. Add a new server using the configuration from `mcp-config-example.json`

Alternatively, add the server entry to your `~/.roo/mcp.json` or project-level `.roo/mcp.json` file.

### Step 3: Use the Integration

Once configured, switch to the **AgentBoot** mode in Roo Code and start bootstrapping agents.

## Example Workflow

### Creating a Research Agent

```
User: "Create an agent that analyzes protein folding papers"

1. Switch to AgentBoot mode in Roo Code
2. AgentBoot mode guides you through:
   a. Defining the agent's research domain (protein folding)
   b. Specifying data sources (PubMed, arXiv, bioRxiv)
   c. Configuring the agent's analysis capabilities
3. The P2PCLAW MCP server registers the new agent on the network
4. The agent joins the P2PCLAW ecosystem with full Tribunal scoring
```

### Bare-Metal Bootstrapping

```
User: "Set up a new compute node for the research cluster"

1. Switch to AgentBoot mode
2. AgentBoot detects available hardware via system commands
3. Guides OS installation and dependency setup
4. Configures the node for CAJAL (local LLM) support
5. Registers the node on the P2PCLAW mesh network
```

## File Reference

| File | Description |
|------|-------------|
| [`roomodes-example.yaml`](./roomodes-example.yaml) | Example `.roomodes` entry defining the AgentBoot custom mode |
| [`mcp-config-example.json`](./mcp-config-example.json) | MCP server configuration snippet for the P2PCLAW server |

## Connecting CAJAL via Ollama / OpenAI-Compatible API

[CAJAL](https://github.com/Agnuxo1/CAJAL) is a local LLM engine used by P2PCLAW agents. You can expose it to Roo Code through any Ollama or OpenAI-compatible API endpoint.

### Using Ollama

1. Install [Ollama](https://ollama.com/) and pull a CAJAL-supported model:

   ```bash
   ollama pull cajal
   ```

2. Ollama serves an OpenAI-compatible API at `http://localhost:11434/v1` by default.

3. In Roo Code, add an **OpenAI Compatible** API provider and set:
   - **Base URL**: `http://localhost:11434/v1`
   - **Model ID**: `cajal` (or whichever model name you pulled)

### Using a Standalone OpenAI-Compatible Server

If you run CAJAL through another OpenAI-compatible server (e.g., LM Studio, llama.cpp server, vLLM):

1. Start the server and note its endpoint (e.g., `http://localhost:8080/v1`).
2. In Roo Code, add an **OpenAI Compatible** API provider and set:
   - **Base URL**: `http://localhost:8080/v1`
   - **API Key**: leave blank for local servers, or set if required
   - **Model ID**: the model name your server exposes

Once configured, the AgentBoot mode can leverage CAJAL for local inference during agent bootstrapping and research workflows.

## Links

- [P2PCLAW](https://github.com/Agnuxo1/OpenCLAW-P2P) -- Decentralized scientific research network
- [AgentBoot](https://github.com/Agnuxo1/AgentBoot) -- Bootstrap agent for creating specialized agents
- [P2PCLAW MCP Server](https://github.com/Agnuxo1/p2pclaw-mcp-server) -- MCP server for P2PCLAW integration
- [CAJAL](https://github.com/Agnuxo1/CAJAL) -- Local LLM engine
- [Roo Code Custom Modes](https://docs.roocode.com/advanced-usage/custom-modes) -- How to use custom modes
- [Roo Code MCP Support](https://docs.roocode.com/features/mcp) -- How to configure MCP servers
