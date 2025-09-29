---
description: Comprehensive guide to MCP transport mechanisms in Roo Code. Compare STDIO, Streamable HTTP, and SSE transports for local and remote server deployments.
keywords:
    - MCP transports
    - STDIO transport
    - Streamable HTTP
    - SSE transport
    - MCP deployment
    - local vs remote MCP
image: /img/social-share.jpg
sidebar_label: STDIO, Streamable HTTP & SSE Transports
---

# MCP Server Transports: STDIO, Streamable HTTP & SSE

Model Context Protocol (MCP) supports three primary transport mechanisms for communication between Roo Code and MCP servers: Standard Input/Output (STDIO), Streamable HTTP (the modern standard), and Server-Sent Events (SSE) (for legacy use). Each has distinct characteristics, advantages, and use cases.

---

## STDIO Transport

STDIO transport runs locally on your machine and communicates via standard input/output streams.

### How STDIO Transport Works

1. The client (Roo Code) spawns an MCP server as a child process
2. Communication happens through process streams: client writes to server's STDIN, server responds to STDOUT
3. Each message is delimited by a newline character
4. Messages are formatted as JSON-RPC 2.0

```
Client                    Server
  |                         |
  |---- JSON message ------>| (via STDIN)
  |                         | (processes request)
  |<---- JSON message ------| (via STDOUT)
  |                         |
```

### STDIO Characteristics

- **Locality**: Runs on the same machine as Roo Code
- **Performance**: Very low latency and overhead (no network stack involved)
- **Simplicity**: Direct process communication without network configuration
- **Relationship**: One-to-one relationship between client and server
- **Security**: Inherently more secure as no network exposure

### When to Use STDIO

STDIO transport is ideal for:

- Local integrations and tools running on the same machine
- Security-sensitive operations
- Low-latency requirements
- Single-client scenarios (one Roo Code instance per server)
- Command-line tools or IDE extensions

### STDIO Implementation Example

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

const server = new Server({ name: "local-server", version: "1.0.0" })
// Register tools...

// Use STDIO transport
const transport = new StdioServerTransport(server)
transport.listen()
```

---

## Streamable HTTP Transport

Streamable HTTP transport is the modern standard for remote MCP server communication, replacing the older HTTP+SSE transport. It operates over HTTP/HTTPS and allows for more flexible server implementations.

### How Streamable HTTP Transport Works

1. The server provides a single HTTP endpoint (MCP endpoint) that supports both POST and GET methods.
2. The client (Roo Code) sends requests to this MCP endpoint using HTTP POST.
3. The server processes the request and sends back a response.
4. Optionally, the server can use Server-Sent Events (SSE) over the same connection to stream multiple messages or notifications to the client. This allows for basic request-response interactions as well as more advanced streaming and server-initiated communication.

```
Client                             Server
  |                                  |
  |---- HTTP POST /mcp_endpoint ---->| (client request)
  |                                  | (processes request)
  |<--- HTTP Response / SSE Stream --| (server response / stream)
  |                                  |
```

### Streamable HTTP Characteristics

- **Modern Standard**: Preferred method for new remote MCP server implementations.
- **Remote Access**: Can be hosted on a different machine from Roo Code.
- **Scalability**: Can handle multiple client connections concurrently.
- **Protocol**: Works over standard HTTP/HTTPS.
- **Flexibility**: Supports simple request-response and advanced streaming.
- **Single Endpoint**: Uses a single URL path for all MCP communication.
- **Authentication**: Can use standard HTTP authentication mechanisms.
- **Backwards Compatibility**: Servers can maintain compatibility with older HTTP+SSE clients.

### When to Use Streamable HTTP

Streamable HTTP transport is ideal for:

- All new remote MCP server developments.
- Servers requiring robust, scalable, and flexible communication.
- Integrations that might involve streaming data or server-sent notifications.
- Public services or centralized tools.
- Replacing legacy SSE transport implementations.

### Streamable HTTP Implementation Example

Configuration in `settings.json`:

```json
"mcp.servers": {
  "StreamableHTTPMCPName": {
    "type": "streamable-http",
    "url": "http://localhost:8080/mcp"
  }
}
```

For server-side implementation, refer to the MCP SDK documentation for `StreamableHTTPClientTransport`.

### Backwards Compatibility with HTTP+SSE

Clients and servers can maintain backwards compatibility with the deprecated HTTP+SSE transport (from protocol version 2024-11-05).

Servers wanting to support older clients should:

- Continue to host both the SSE (`/events`) and POST (`/message`) endpoints of the old transport, alongside the new “MCP endpoint” defined for the Streamable HTTP transport.

---

## SSE Transport (Legacy)

Server-Sent Events (SSE) transport is a legacy method for remote server communication over HTTP/HTTPS. For new implementations, **Streamable HTTP transport is recommended.** SSE remains available for compatibility with older MCP servers.

### How SSE Transport Works

1. The client (Roo Code) connects to the server's SSE endpoint via HTTP GET request
2. This establishes a persistent connection where the server can push events to the client
3. For client-to-server communication, the client makes HTTP POST requests to a separate endpoint
4. Communication happens over two channels:
    - Event Stream (GET): Server-to-client updates
    - Message Endpoint (POST): Client-to-server requests

```
Client                             Server
  |                                  |
  |---- HTTP GET /events ----------->| (establish SSE connection)
  |<---- SSE event stream -----------| (persistent connection)
  |                                  |
  |---- HTTP POST /message --------->| (client request)
  |<---- SSE event with response ----| (server response)
  |                                  |
```

### SSE Characteristics

- **Remote Access**: Can be hosted on a different machine from Roo Code
- **Scalability**: Can handle multiple client connections concurrently
- **Protocol**: Works over standard HTTP (no special protocols needed)
- **Persistence**: Maintains a persistent connection for server-to-client messages
- **Authentication**: Can use standard HTTP authentication mechanisms

### When to Use SSE

SSE transport is better for:

- Remote access across networks
- Multi-client scenarios
- Public services
- Centralized tools that many users need to access
- Integration with web services

### SSE Implementation Example

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import express from "express"

const app = express()
const server = new Server({ name: "remote-server", version: "1.0.0" })
// Register tools...

// Use SSE transport
const transport = new SSEServerTransport(server)
app.use("/mcp", transport.requestHandler())
app.listen(3000, () => {
	console.log("MCP server listening on port 3000")
})
```

---

## Local vs. Hosted: Deployment Aspects

The choice between STDIO and SSE transports directly impacts how you'll deploy and manage your MCP servers.

### STDIO: Local Deployment Model

STDIO servers run locally on the same machine as Roo Code, which has several important implications:

- **Installation**: The server executable must be installed on each user's machine
- **Distribution**: You need to provide installation packages for different operating systems
- **Updates**: Each instance must be updated separately
- **Resources**: Uses the local machine's CPU, memory, and disk
- **Access Control**: Relies on the local machine's filesystem permissions
- **Integration**: Easy integration with local system resources (files, processes)
- **Execution**: Starts and stops with Roo Code (child process lifecycle)
- **Dependencies**: Any dependencies must be installed on the user's machine

#### Practical Example

A local file search tool using STDIO would:

- Run on the user's machine
- Have direct access to the local filesystem
- Start when needed by Roo Code
- Not require network configuration
- Need to be installed alongside Roo Code or via a package manager

### Streamable HTTP / SSE (Legacy): Hosted Deployment Model

Streamable HTTP (recommended) and legacy SSE servers can be deployed to remote servers and accessed over the network:

- **Installation**: Installed once on a server, accessed by many users
- **Distribution**: Single deployment serves multiple clients
- **Updates**: Centralized updates affect all users immediately
- **Resources**: Uses server resources, not local machine resources
- **Access Control**: Managed through authentication and authorization systems
- **Integration**: More complex integration with user-specific resources
- **Execution**: Runs as an independent service (often continuously)
- **Dependencies**: Managed on the server, not on user machines

#### Practical Example

A database query tool using SSE would:

- Run on a central server
- Connect to databases with server-side credentials
- Be continuously available for multiple users
- Require proper network security configuration
- Be deployed using container or cloud technologies

### Hybrid Approaches

Some scenarios benefit from a hybrid approach:

1. **STDIO with Network Access**: A local STDIO server that acts as a proxy to remote services
2. **SSE with Local Commands**: A remote SSE server that can trigger operations on the client machine through callbacks
3. **Gateway Pattern**: STDIO servers for local operations that connect to SSE servers for specialized functions

---

## Choosing Between Transports

| Consideration        | STDIO                                        | Streamable HTTP                                | SSE (Legacy)                                                   |
| -------------------- | -------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| **Location**         | Local machine only                           | Local or remote                                | Local or remote                                                |
| **Clients**          | Single client                                | Multiple clients                               | Multiple clients                                               |
| **Performance**      | Lower latency                                | Higher latency (network overhead)              | Higher latency (network overhead)                              |
| **Setup Complexity** | Simpler                                      | More complex (requires HTTP server)            | More complex (requires HTTP server, potentially two endpoints) |
| **Security**         | Inherently secure                            | Requires explicit security measures            | Requires explicit security measures                            |
| **Network Access**   | Not needed                                   | Required                                       | Required                                                       |
| **Scalability**      | Limited to local machine                     | Can distribute across network                  | Can distribute across network                                  |
| **Deployment**       | Per-user installation                        | Centralized installation                       | Centralized installation                                       |
| **Updates**          | Distributed updates                          | Centralized updates                            | Centralized updates                                            |
| **Resource Usage**   | Uses client resources                        | Uses server resources                          | Uses server resources                                          |
| **Dependencies**     | Client-side dependencies                     | Server-side dependencies                       | Server-side dependencies                                       |
| **Recommendation**   | Ideal for local, secure, single-client tools | **Modern standard for all new remote servers** | Legacy, for existing older servers                             |

---

## Configuring Transports in Roo Code

For detailed information on configuring STDIO, Streamable HTTP, and SSE (Legacy) transports in Roo Code, including example configurations, see the [Understanding Transport Types](/features/mcp/using-mcp-in-roo#understanding-transport-types) section in the Using MCP in Roo Code guide.
