import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { z } from "zod"
import * as http from "http"
import * as vscode from "vscode"
import { ClineProvider } from "../webview/ClineProvider"
import { fileURLToPath } from "url"
import fs from "fs"
import { type ClineAskResponse } from "../../shared/WebviewMessage"
import { type Mode } from "../../shared/modes"

let serverInstance: http.Server | undefined
let sseTransport: SSEServerTransport | undefined

/**
 * Starts the Jabberwock DevTools MCP Server as an isolated SSE Server.
 * @param provider The ClineProvider instance for direct interaction with UI and tasks.
 * @returns The port where the SSE server is listening.
 */
export async function startJabberwockMcpServer(provider: ClineProvider): Promise<number> {
	if (serverInstance) {
		const address = serverInstance.address()
		if (typeof address === "object" && address !== null) {
			return address.port
		}
	}

	const mcpServer = new McpServer({
		name: "Jabberwock DevTools",
		version: "1.0.0",
	})

	// Tool 1: Interact with the UI (continue, cancel)
	mcpServer.tool(
		"interact_with_ui",
		{
			action: z
				.enum(["continue", "cancel"])
				.describe("Action to take: continue or cancel the current task generation"),
		},
		async ({ action }) => {
			try {
				const currentTask = provider.getCurrentTask()
				if (!currentTask) {
					return { content: [{ type: "text", text: "Error: No active task available" }], isError: true }
				}

				if (action === "continue") {
					// Post message to webview to simulate primary button click
					await provider.postMessageToWebview({ type: "invoke", invoke: "primaryButtonClick" })
					return { content: [{ type: "text", text: "Successfully invoked primary button (Continue)." }] }
				} else if (action === "cancel") {
					// Post message to webview to simulate secondary/cancel button click
					await provider.postMessageToWebview({ type: "invoke", invoke: "secondaryButtonClick" })
					return { content: [{ type: "text", text: "Successfully invoked secondary button (Cancel)." }] }
				}

				return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	// Tool 2: Review Diagnostic Logs
	mcpServer.tool(
		"read_diagnostics",
		{
			lines: z.number().optional().describe("Number of recent lines to read. Default is 100."),
		},
		async ({ lines = 100 }) => {
			try {
				const logPath = vscode.Uri.joinPath(
					provider.contextProxy.globalStorageUri,
					"jabberwock.diagnostics.log",
				).fsPath
				if (!fs.existsSync(logPath)) {
					return { content: [{ type: "text", text: "Diagnostics log file does not exist yet." }] }
				}
				const content = fs.readFileSync(logPath, "utf-8")
				const logLines = content.split("\n").filter(Boolean)
				const recent = logLines.slice(-Math.abs(lines))
				return { content: [{ type: "text", text: recent.join("\n") }] }
			} catch (error) {
				return {
					content: [
						{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` },
					],
					isError: true,
				}
			}
		},
	)

	// Tool 3: Send Chat Request (Starts a new task)
	mcpServer.tool(
		"send_chat_request",
		{
			prompt: z.string().describe("The text of the request to send to Jabberwock (starts a new task)"),
		},
		async ({ prompt }) => {
			try {
				// Reset UI state for the new task
				await provider.postMessageToWebview({ type: "invoke", invoke: "newChat" })
				await provider.createTask(prompt)
				return { content: [{ type: "text", text: `Successfully started new task with prompt: "${prompt}"` }] }
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error starting task: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	// Tool 4: Respond to Ask (Approve/Reject tool uses)
	mcpServer.tool(
		"respond_to_ask",
		{
			response: z
				.enum(["yesButtonClicked", "noButtonClicked", "messageResponse", "objectResponse"])
				.describe("The type of response for the current question/ask"),
			text: z.string().optional().describe("Optional feedback text for the response"),
		},
		async ({ response, text }) => {
			try {
				const currentTask = provider.getCurrentTask()
				if (!currentTask) {
					return { content: [{ type: "text", text: "Error: No active task to respond to" }], isError: true }
				}

				// Respond to the task's current ask
				currentTask.handleWebviewAskResponse(response as ClineAskResponse, text, undefined)
				return {
					content: [{ type: "text", text: `Successfully sent response "${response}" to current task.` }],
				}
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error responding to task: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	// Tool 5: Switch Mode
	mcpServer.tool(
		"switch_mode",
		{
			mode: z.string().describe("The slug of the mode to switch to (e.g. 'architect', 'coder', 'ask')"),
		},
		async ({ mode }) => {
			try {
				await provider.handleModeSwitch(mode as Mode)
				return { content: [{ type: "text", text: `Successfully switched to mode: ${mode}` }] }
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error switching mode: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	// Tool 6: Get MST (MobX-State-Tree) state snapshot
	mcpServer.tool(
		"get_mst_state",
		{
			nodeId: z.string().optional().describe("Optional: specific node ID to inspect. Omit for full tree."),
		},
		async ({ nodeId }) => {
			try {
				const { getSnapshot } = await import("mobx-state-tree")
				const snapshot = getSnapshot(provider.chatStore)

				if (nodeId) {
					const nodes = snapshot.nodes as Record<string, unknown>
					const node = nodes[nodeId]
					if (!node) {
						return {
							content: [{ type: "text", text: `Node '${nodeId}' not found in ChatStore.` }],
							isError: true,
						}
					}
					return { content: [{ type: "text", text: JSON.stringify(node, null, 2) }] }
				}

				return { content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }] }
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error reading MST state: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				}
			}
		},
	)

	// Tool 7: Get full diagnostics snapshot (logs, metrics, resources, MST patches)
	mcpServer.tool("get_diagnostics_snapshot", {}, async () => {
		try {
			const { diagnosticsManager } = await import("./DiagnosticsManager")
			const snapshot = diagnosticsManager.getSnapshot()
			return { content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }] }
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Error reading diagnostics: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	})

	return new Promise((resolve, reject) => {
		serverInstance = http.createServer((req, res) => {
			const parsedUrl = new URL(req.url || "", `http://${req.headers.host || "localhost"}`)
			const pathname = parsedUrl.pathname

			if (pathname === "/sse") {
				sseTransport = new SSEServerTransport("/messages", res)
				mcpServer.connect(sseTransport).catch(console.error)
			} else if (pathname === "/messages" && req.method === "POST") {
				if (sseTransport) {
					sseTransport.handlePostMessage(req, res).catch(console.error)
				} else {
					res.writeHead(503).end("SSE transport not initialized")
				}
			} else {
				res.writeHead(404).end("Not found")
			}
		})

		serverInstance.on("error", (err) => {
			serverInstance = undefined
			reject(err)
		})

		const STATIC_PORT = 60060

		serverInstance.listen(STATIC_PORT, "127.0.0.1", () => {
			const address = serverInstance?.address()
			if (typeof address === "object" && address !== null) {
				console.log(`[Jabberwock DevTools] MCP Server listening on static port ${address.port}`)
				resolve(address.port)
			} else {
				reject(new Error("Failed to get port"))
			}
		})
	})
}

export function stopJabberwockMcpServer() {
	if (sseTransport) {
		sseTransport.close().catch(console.error)
		sseTransport = undefined
	}
	if (serverInstance) {
		serverInstance.close()
		serverInstance = undefined
	}
}
