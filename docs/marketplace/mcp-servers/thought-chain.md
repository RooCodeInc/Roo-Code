# Thought Chain MCP Server

## Overview

The Thought Chain MCP Server is an advanced reasoning engine that empowers AI models with sophisticated step-by-step thinking capabilities. It provides structured thinking frameworks, persistent memory across sessions, and complex problem decomposition.

**Repository**: https://github.com/cbuntingde/thought-chain-mcp  
**Author**: Chris Bunting (@cbuntingde)  
**License**: MIT  
**Version**: 1.1.0

## Key Features

- **Structured Thinking Framework**: Guides AI models through systematic, logical reasoning processes
- **Persistent Memory**: Maintains context and reasoning chains across conversations and sessions using SQLite
- **Complex Problem Decomposition**: Breaks down intricate problems into manageable, logical steps
- **Cross-Model Consistency**: Ensures high-quality reasoning regardless of the underlying AI model
- **Universal Compatibility**: Works with any MCP-compatible editor or AI assistant

## Installation

The Thought Chain MCP server can be installed via NPX:

```bash
npx thought-chain-mcp
```

Or globally:

```bash
npm install -g thought-chain-mcp
```

## Configuration

To add the Thought Chain MCP server to Roo Code, add the following configuration to your MCP settings file:

```json
{
	"mcpServers": {
		"thought-chain": {
			"type": "stdio",
			"command": "npx",
			"args": ["thought-chain-mcp"],
			"description": "Advanced reasoning engine with persistent thought chains",
			"alwaysAllow": []
		}
	}
}
```

## Available Tools

The Thought Chain MCP server provides the following tools:

1. **start_chain**: Begin a new thought chain with an initial thought
2. **add_thought**: Add a new step to the current chain with optional reflection
3. **review_chain**: Display the current thought chain progress
4. **conclude_chain**: Finalize the current chain with a conclusion
5. **recall_chains**: Search and retrieve previous thought chains by content
6. **get_chain_by_id**: Retrieve a specific thought chain by its ID
7. **list_recent_chains**: List recently created thought chains
8. **delete_chain**: Remove a specific thought chain from storage

## Use Cases

- **Complex Problem Solving**: Break down intricate problems into logical steps
- **Decision Making**: Document and track reasoning processes for important decisions
- **Learning and Analysis**: Build upon previous thought processes across sessions
- **Audit Trails**: Maintain documented reasoning for compliance and review
- **Cross-Session Continuity**: Resume complex reasoning work across different sessions

## Requirements

- Node.js 20.0.0 or higher
- npm (latest stable version)
- SQLite (automatically handled by the server)

## Comparison with Sequential Thinking

While Sequential Thinking provides basic step-by-step reasoning, Thought Chain offers:

- **Persistence**: All thought chains are saved to a database
- **Recall System**: Search and retrieve previous reasoning processes
- **Reflection Support**: Add notes on how each step builds on previous ones
- **Chain Management**: Start, review, and conclude thought processes
- **Cross-Session Support**: Continue reasoning across different sessions

## Security Considerations

- Input validation and secure data handling
- ACID-compliant SQLite database for data integrity
- No external API dependencies for core functionality
- Local data storage for privacy

## Support

For issues or questions about the Thought Chain MCP server:

- GitHub Issues: https://github.com/cbuntingde/thought-chain-mcp/issues
- Author: Chris Bunting <cbunting99@gmail.com>

## Marketplace Metadata

```yaml
id: thought-chain
name: Thought Chain
description: Advanced reasoning engine with persistent thought chains for complex problem-solving
author: Chris Bunting
repository: https://github.com/cbuntingde/thought-chain-mcp
npm_package: thought-chain-mcp
version: 1.1.0
license: MIT
tags:
    - reasoning
    - thinking
    - persistence
    - problem-solving
    - analysis
categories:
    - Productivity
    - Development Tools
```
