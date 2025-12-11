# Marketplace Documentation

This directory contains documentation for marketplace items (MCP servers and custom modes) that have been suggested for inclusion in the Roo Code marketplace.

## Structure

- `/mcp-servers/` - Documentation for MCP (Model Context Protocol) servers
- `/modes/` - Documentation for custom modes (if applicable)

## Adding New MCP Servers

To suggest a new MCP server for the marketplace:

1. **Create an Issue**: Use the [Marketplace Feedback](https://github.com/RooCodeInc/Roo-Code/issues/new?template=marketplace.yml) template
2. **Provide Documentation**: Create a markdown file in `/docs/marketplace/mcp-servers/` with:

    - Overview and key features
    - Installation instructions
    - Configuration examples
    - Available tools/commands
    - Use cases
    - Requirements
    - Support information

3. **Submit a PR**: Create a pull request with your documentation

## Current Process

The marketplace items are managed through a centralized API service. Documentation in this directory serves as:

- A reference for the Roo Code team when evaluating new marketplace additions
- A staging area for community-suggested items
- Documentation for users who want to manually configure these servers

## Manual Installation

While waiting for official marketplace inclusion, users can manually install MCP servers by:

1. Installing the server package (usually via npm/npx)
2. Adding the configuration to their MCP settings file (`.roo/mcp.json` in their project or global settings)
3. Restarting Roo Code to load the new server

## Example Configuration

```json
{
	"mcpServers": {
		"server-name": {
			"type": "stdio",
			"command": "npx",
			"args": ["package-name"],
			"description": "Server description",
			"alwaysAllow": []
		}
	}
}
```

## Contributing

We welcome contributions! Please ensure your documentation includes:

- Clear description of what the server/mode does
- Installation requirements
- Configuration examples
- List of available tools or features
- Any security considerations
- Links to the original repository

## Note

Official marketplace inclusion requires review by the Roo Code team. Documentation here does not guarantee immediate availability in the marketplace UI, but helps track community suggestions and provides manual installation guidance.
