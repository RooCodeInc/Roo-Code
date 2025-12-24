# Adding MCP Servers to the Roo Code Marketplace

## Overview

The Roo Code Marketplace provides a centralized location for discovering and installing MCP (Model Context Protocol) servers. This document describes how MCP servers are configured and provides guidance for requesting new servers to be added.

## MCP Server Configuration Structure

MCP servers in the marketplace are defined with the following structure:

```typescript
interface McpMarketplaceItem {
	id: string // Unique identifier for the server
	name: string // Display name
	description: string // Brief description of functionality
	author?: string // Author/organization name
	authorUrl?: string // Link to author's website or GitHub
	url: string // Repository URL
	type: "mcp" // Item type (always "mcp" for servers)
	tags?: string[] // Searchable tags
	prerequisites?: string[] // Installation requirements
	content: string | McpInstallationMethod[] // Server configuration
	parameters?: McpParameter[] // Configurable parameters
}
```

### Basic MCP Server Configuration

For a simple MCP server that runs via NPX:

```json
{
	"id": "example-mcp",
	"name": "Example MCP Server",
	"description": "An example MCP server for demonstration",
	"url": "https://github.com/example/example-mcp",
	"type": "mcp",
	"content": "{\"command\": \"npx\", \"args\": [\"-y\", \"@example/mcp-server\"]}"
}
```

### MCP Server with Parameters

For servers that require configuration:

```json
{
	"id": "configurable-mcp",
	"name": "Configurable MCP Server",
	"description": "MCP server with user-configurable options",
	"url": "https://github.com/example/configurable-mcp",
	"type": "mcp",
	"content": "{\"command\": \"npx\", \"args\": [\"-y\", \"@example/mcp-server\"], \"env\": {\"API_KEY\": \"{{API_KEY}}\"}}",
	"parameters": [
		{
			"name": "API Key",
			"key": "API_KEY",
			"placeholder": "Enter your API key",
			"optional": false
		}
	]
}
```

### Multiple Installation Methods

For servers with different installation options:

```json
{
	"id": "multi-install-mcp",
	"name": "Multi-Install MCP Server",
	"description": "MCP server with multiple installation methods",
	"url": "https://github.com/example/multi-mcp",
	"type": "mcp",
	"content": [
		{
			"name": "NPX (Recommended)",
			"content": "{\"command\": \"npx\", \"args\": [\"-y\", \"@example/mcp\"]}"
		},
		{
			"name": "Docker",
			"content": "{\"command\": \"docker\", \"args\": [\"run\", \"-p\", \"3000:3000\", \"example/mcp:latest\"]}",
			"prerequisites": ["Docker installed and running"]
		},
		{
			"name": "Global Install",
			"content": "{\"command\": \"example-mcp\", \"args\": []}",
			"prerequisites": ["Install globally first: npm install -g @example/mcp"]
		}
	]
}
```

## Example: Appium MCP Server Configuration

The Appium MCP Server, as requested in issue #9479, would be configured as follows:

```json
{
	"id": "appium-mcp",
	"name": "Appium MCP Server",
	"description": "MCP server for Mobile Development and Automation | iOS, Android, Simulator, Emulator, and Real Devices",
	"author": "Appium Contributors",
	"authorUrl": "https://github.com/appium",
	"url": "https://github.com/appium/appium-mcp",
	"type": "mcp",
	"tags": ["mobile", "automation", "ios", "android", "testing", "appium"],
	"prerequisites": [
		"Node.js 16+ and npm installed",
		"Appium installed globally or locally",
		"Platform-specific requirements (Xcode for iOS, Android SDK for Android)"
	],
	"content": "{\"command\": \"npx\", \"args\": [\"-y\", \"@appium/mcp-server\"], \"env\": {\"APPIUM_HOST\": \"localhost\", \"APPIUM_PORT\": \"4723\"}}",
	"parameters": [
		{
			"name": "Appium Host",
			"key": "APPIUM_HOST",
			"placeholder": "localhost",
			"optional": true
		},
		{
			"name": "Appium Port",
			"key": "APPIUM_PORT",
			"placeholder": "4723",
			"optional": true
		}
	]
}
```

## MCP Server Capabilities

When documenting an MCP server for the marketplace, include information about its capabilities:

### Tools

List the tools/commands the server exposes:

- `launch_app` - Launch a mobile application
- `find_element` - Find UI elements
- `take_screenshot` - Capture device screen
- etc.

### Resources

List the resources available:

- `device_list` - Available devices
- `session_info` - Current session details
- etc.

### Prompts

List any pre-configured prompts:

- `test_login_flow` - Automate login testing
- `validate_ui_elements` - Check UI consistency
- etc.

## How to Request a New MCP Server

To request a new MCP server be added to the marketplace:

1. **Open an Issue**: Create a GitHub issue in the Roo Code repository
2. **Provide Information**:
    - Server name and description
    - GitHub repository URL
    - Installation command (NPX, Docker, etc.)
    - Any required configuration parameters
    - Prerequisites for installation
    - List of capabilities (tools, resources, prompts)
3. **Include Examples**: Provide example use cases or documentation links
4. **Test the Server**: Confirm the server works with the MCP protocol

## Technical Implementation

The marketplace items are fetched from a remote API endpoint managed by the Roo Code team. The actual configuration data is stored server-side and retrieved by the extension at runtime.

### API Endpoints

- Modes: `https://api.roocode.com/api/marketplace/modes`
- MCP Servers: `https://api.roocode.com/api/marketplace/mcps`

### Local Testing

For development and testing, you can mock MCP server configurations using the test framework as shown in `src/services/marketplace/__tests__/appium-mcp-server.spec.ts`.

## Best Practices

1. **Clear Naming**: Use descriptive, unique IDs and names
2. **Comprehensive Descriptions**: Explain what the server does and its use cases
3. **Document Prerequisites**: List all requirements for successful installation
4. **Provide Parameters**: Allow users to configure server behavior
5. **Tag Appropriately**: Use relevant tags for discoverability
6. **Test Thoroughly**: Ensure the server configuration works before submission

## Security Considerations

- Never include sensitive information (API keys, passwords) in the configuration
- Use parameter placeholders for user-specific values
- Verify server authenticity through official repository URLs
- Review server permissions and capabilities before installation

## Support

For questions about adding MCP servers to the marketplace:

- Open a GitHub issue with the "enhancement" label
- Join the community discussions
- Refer to the MCP protocol documentation
