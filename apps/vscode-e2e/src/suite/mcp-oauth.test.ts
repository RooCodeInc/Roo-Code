import * as assert from "assert"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import * as http from "http"
import * as vscode from "vscode"

import { waitFor, sleep } from "./utils"
import { setDefaultSuiteTimeout } from "./test-utils"

/**
 * Minimal MCP-protocol-aware request handler.
 *
 * The SDK's StreamableHTTPClientTransport uses:
 *  - GET  /mcp  → SSE stream (we return 405 to indicate not supported)
 *  - POST /mcp  → JSON-RPC messages (initialize, tools/list, etc.)
 */
function handleMcpRequest(req: http.IncomingMessage, res: http.ServerResponse, endpointsHit: Set<string>): void {
	if (req.method === "GET") {
		// Signal that we don't support the SSE push channel.
		// The SDK treats 405 as "SSE not supported, POST-only mode".
		endpointsHit.add("mcp-authed-get")
		res.writeHead(405)
		res.end()
		return
	}

	// POST — read body, parse JSON-RPC, dispatch
	let body = ""
	req.on("data", (chunk) => (body += chunk))
	req.on("end", () => {
		endpointsHit.add("mcp-authed")

		let message: { id?: number; method?: string }
		try {
			message = JSON.parse(body)
		} catch {
			res.writeHead(400)
			res.end()
			return
		}

		// Notifications (no id) → 202 Accepted
		if (message.id === undefined) {
			res.writeHead(202)
			res.end()
			return
		}

		let result: unknown
		switch (message.method) {
			case "initialize":
				result = {
					protocolVersion: "2024-11-05",
					capabilities: {},
					serverInfo: { name: "test-oauth-server", version: "1.0.0" },
				}
				break
			case "tools/list":
				result = { tools: [] }
				break
			case "resources/list":
				result = { resources: [] }
				break
			case "resources/templates/list":
				result = { resourceTemplates: [] }
				break
			default:
				result = {}
		}

		res.writeHead(200, { "Content-Type": "application/json" })
		res.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }))
	})
}

suite("Roo Code MCP OAuth", function () {
	setDefaultSuiteTimeout(this)

	let tempDir: string
	let testFiles: { mcpConfig: string }
	let mockServer: http.Server
	let mockServerPort: number

	// Track which OAuth / MCP endpoints were hit
	const endpointsHit: Set<string> = new Set()

	suiteSetup(async () => {
		// Enable test mode so the OAuth callback server resolves immediately
		// without needing a real browser redirect.
		process.env.MCP_OAUTH_TEST_MODE = "true"

		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "roo-test-mcp-oauth-"))

		mockServer = http.createServer((req, res) => {
			const url = req.url || ""
			console.log(`[MOCK SERVER] ${req.method} ${url}`)

			// ── MCP endpoint ─────────────────────────────────────────────
			if (url === "/mcp" || url.startsWith("/mcp?") || url.startsWith("/mcp/")) {
				const authHeader = req.headers.authorization
				if (!authHeader || !authHeader.startsWith("Bearer ")) {
					endpointsHit.add("mcp-401")
					res.writeHead(401, {
						"WWW-Authenticate": `Bearer resource_metadata="http://localhost:${mockServerPort}/.well-known/oauth-protected-resource"`,
					})
					res.end()
				} else {
					// Authenticated — handle as MCP protocol
					handleMcpRequest(req, res, endpointsHit)
				}
				return
			}

			// ── OAuth discovery / registration / token endpoints ─────────

			if (url === "/.well-known/oauth-protected-resource") {
				endpointsHit.add("resource-metadata")
				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(
					JSON.stringify({
						resource: `http://localhost:${mockServerPort}/mcp`,
						authorization_servers: [`http://localhost:${mockServerPort}/auth`],
					}),
				)
				return
			}

			// SDK constructs: new URL("/.well-known/oauth-authorization-server", "http://host/auth")
			// which resolves to http://host/.well-known/oauth-authorization-server (origin-relative)
			// Our custom fetchOAuthAuthServerMetadata constructs the RFC 8414 URL with issuer path:
			//   /.well-known/oauth-authorization-server/auth  (with issuer path)
			// Handle BOTH forms so our provider gets _authServerMeta.
			if (
				url === "/.well-known/oauth-authorization-server" ||
				url === "/.well-known/oauth-authorization-server/auth"
			) {
				endpointsHit.add("auth-metadata")
				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(
					JSON.stringify({
						issuer: `http://localhost:${mockServerPort}/auth`,
						authorization_endpoint: `http://localhost:${mockServerPort}/auth/authorize`,
						token_endpoint: `http://localhost:${mockServerPort}/auth/token`,
						registration_endpoint: `http://localhost:${mockServerPort}/auth/register`,
						code_challenge_methods_supported: ["S256"],
						response_types_supported: ["code"],
					}),
				)
				return
			}

			if (url === "/auth/register" && req.method === "POST") {
				endpointsHit.add("register")
				res.writeHead(201, { "Content-Type": "application/json" })
				res.end(
					JSON.stringify({
						client_id: "test-client-id",
						redirect_uris: ["http://localhost:3000/callback"],
					}),
				)
				return
			}

			if (url === "/auth/token" && req.method === "POST") {
				endpointsHit.add("token")
				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(
					JSON.stringify({
						access_token: "test-access-token",
						token_type: "Bearer",
						expires_in: 3600,
					}),
				)
				return
			}

			// Capture authorize hits (only reachable if a real browser is present)
			if (url.startsWith("/auth/authorize")) {
				endpointsHit.add("authorize")
				res.writeHead(200, { "Content-Type": "text/plain" })
				res.end("Authorization endpoint reached")
				return
			}

			res.writeHead(404)
			res.end()
		})

		// Find an available port
		mockServerPort = await new Promise<number>((resolve, reject) => {
			mockServer.listen(0, "127.0.0.1", () => {
				const addr = mockServer.address()
				if (!addr || typeof addr === "string") return reject(new Error("Failed to get address"))
				resolve(addr.port)
			})
			mockServer.on("error", reject)
		})

		const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || tempDir
		const rooDir = path.join(workspaceDir, ".roo")
		await fs.mkdir(rooDir, { recursive: true })

		const mcpConfig = {
			mcpServers: {
				"test-oauth-server": {
					type: "streamable-http",
					url: `http://localhost:${mockServerPort}/mcp`,
				},
			},
		}

		testFiles = { mcpConfig: path.join(rooDir, "mcp.json") }
		await fs.writeFile(testFiles.mcpConfig, JSON.stringify(mcpConfig, null, 2))

		console.log("[TEST] Mock server port:", mockServerPort)
		console.log("[TEST] MCP config:", testFiles.mcpConfig)
	})

	suiteTeardown(async () => {
		delete process.env.MCP_OAUTH_TEST_MODE

		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// Task might not be running
		}

		if (mockServer) {
			await new Promise<void>((resolve) => mockServer.close(() => resolve()))
		}

		for (const filePath of Object.values(testFiles)) {
			try {
				await fs.unlink(filePath)
			} catch {
				// ignore
			}
		}

		const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || tempDir
		try {
			await fs.rm(path.join(workspaceDir, ".roo"), { recursive: true, force: true })
		} catch {
			// ignore
		}

		await fs.rm(tempDir, { recursive: true, force: true })
	})

	setup(async () => {
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// ignore
		}
		endpointsHit.clear()
		await sleep(100)
	})

	teardown(async () => {
		try {
			await globalThis.api.cancelCurrentTask()
		} catch {
			// ignore
		}
		await sleep(100)
	})

	test("Should complete the full OAuth flow when connecting to an OAuth-protected MCP server", async function () {
		// Re-write the config to trigger the file watcher and force a reconnect.
		const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || tempDir
		const mcpConfigPath = path.join(workspaceDir, ".roo", "mcp.json")

		await fs.writeFile(
			mcpConfigPath,
			JSON.stringify(
				{
					mcpServers: {
						"test-oauth-server": {
							type: "streamable-http",
							url: `http://localhost:${mockServerPort}/mcp`,
						},
					},
				},
				null,
				2,
			),
		)

		// Step 1: Initial connection attempt gets 401 → triggers OAuth discovery
		await waitFor(() => endpointsHit.has("mcp-401"), { timeout: 30_000 })
		console.log("[TEST] Got initial 401, OAuth flow started")

		// Step 2: SDK discovers OAuth metadata
		await waitFor(() => endpointsHit.has("resource-metadata"), { timeout: 15_000 })
		console.log("[TEST] Resource metadata fetched")

		await waitFor(() => endpointsHit.has("auth-metadata"), { timeout: 15_000 })
		console.log("[TEST] Auth server metadata fetched")

		// Step 3: Dynamic client registration
		await waitFor(() => endpointsHit.has("register"), { timeout: 15_000 })
		console.log("[TEST] Client registered")

		// Step 4: In MCP_OAUTH_TEST_MODE the callback server resolves immediately with
		// a test auth code (no real browser needed). The SDK exchanges it for a token.
		await waitFor(() => endpointsHit.has("token"), { timeout: 15_000 })
		console.log("[TEST] Access token obtained")

		// Step 5: The background _completeOAuthFlow task retries client.connect() with
		// the bearer token. Verify the MCP server receives an authenticated request.
		await waitFor(() => endpointsHit.has("mcp-authed"), { timeout: 15_000 })
		console.log("[TEST] MCP server connected with valid Bearer token")

		// Assert the complete OAuth flow ran
		assert.ok(endpointsHit.has("mcp-401"), "MCP server should return 401 to trigger OAuth")
		assert.ok(endpointsHit.has("resource-metadata"), "Resource metadata discovery should run")
		assert.ok(endpointsHit.has("auth-metadata"), "Auth server metadata discovery should run")
		assert.ok(endpointsHit.has("register"), "Dynamic client registration should run")
		assert.ok(endpointsHit.has("token"), "Token exchange should succeed")
		assert.ok(endpointsHit.has("mcp-authed"), "Retry connection should succeed with Bearer token")

		console.log("[TEST] MCP OAuth flow completed successfully. Endpoints hit:", [...endpointsHit])
	})

	test("Should reuse stored token on reconnect without re-running the full OAuth flow", async function () {
		// This test runs after the previous one, so a token is already stored in SecretStorage.
		// Trigger another reconnect — the SDK should inject the cached token directly and skip the
		// browser-based auth flow (no new register or token endpoints should be hit).

		// Clear only mcp-related hit tracking (token endpoint should NOT be re-hit)
		endpointsHit.clear()

		const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || tempDir
		const mcpConfigPath = path.join(workspaceDir, ".roo", "mcp.json")

		// Slightly modify the config to force a reconnect
		await fs.writeFile(
			mcpConfigPath,
			JSON.stringify(
				{
					mcpServers: {
						"test-oauth-server": {
							type: "streamable-http",
							url: `http://localhost:${mockServerPort}/mcp`,
							// A different but valid timeout value triggers config-change detection
							timeout: 30,
						},
					},
				},
				null,
				2,
			),
		)

		// Wait for the MCP server to receive an authenticated request
		await waitFor(() => endpointsHit.has("mcp-authed"), { timeout: 30_000 })
		console.log("[TEST] Token reuse: MCP server got authenticated request")

		// The full OAuth flow should NOT have re-run (token was cached in SecretStorage)
		assert.ok(endpointsHit.has("mcp-authed"), "Reconnect should use cached token")
		assert.ok(!endpointsHit.has("mcp-401"), "Should not get 401 when token is cached")
		assert.ok(!endpointsHit.has("register"), "Should not re-register client when token is cached")

		console.log("[TEST] Token reuse test passed. Endpoints hit:", [...endpointsHit])
	})
})
