#!/usr/bin/env node
/**
 * Telegram Bridge MCP Server for Roo Code
 *
 * This server provides remote control of Roo Code via Telegram.
 * It connects to Roo Code via IPC and forwards messages to Telegram,
 * allowing users to approve/reject operations and send new instructions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { TelegramBridge } from "./telegram-bridge.js"

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID
const ROO_CODE_SOCKET_PATH = process.env.ROO_CODE_SOCKET_PATH

// Create the MCP server
const server = new McpServer({
	name: "telegram-bridge",
	version: "0.1.0",
})

// Telegram bridge instance (created when start_bridge tool is called)
let bridge: TelegramBridge | null = null

// Tool: Start the Telegram bridge
server.tool(
	"start_bridge",
	{
		botToken: z.string().describe("Telegram bot token from @BotFather"),
		chatId: z.string().describe("Telegram chat ID to send messages to"),
		socketPath: z.string().optional().describe("Roo Code IPC socket path (optional, uses default if not provided)"),
		enableTts: z.boolean().optional().describe("Enable text-to-speech for messages (optional)"),
	},
	async ({ botToken, chatId, socketPath, enableTts }) => {
		try {
			if (bridge) {
				await bridge.stop()
			}

			bridge = new TelegramBridge({
				botToken: botToken || TELEGRAM_BOT_TOKEN || "",
				chatId: chatId || TELEGRAM_CHAT_ID || "",
				socketPath: socketPath || ROO_CODE_SOCKET_PATH,
				enableTts: enableTts ?? false,
			})

			await bridge.start()

			return {
				content: [
					{
						type: "text",
						text: "Telegram bridge started successfully. You can now receive Roo Code messages on Telegram.",
					},
				],
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Failed to start Telegram bridge: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	},
)

// Tool: Stop the Telegram bridge
server.tool("stop_bridge", {}, async () => {
	try {
		if (bridge) {
			await bridge.stop()
			bridge = null
		}

		return {
			content: [
				{
					type: "text",
					text: "Telegram bridge stopped.",
				},
			],
		}
	} catch (error) {
		return {
			content: [
				{
					type: "text",
					text: `Failed to stop Telegram bridge: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
			isError: true,
		}
	}
})

// Tool: Get bridge status
server.tool("bridge_status", {}, async () => {
	if (!bridge) {
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({ running: false }, null, 2),
				},
			],
		}
	}

	const status = bridge.getStatus()
	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(status, null, 2),
			},
		],
	}
})

// Tool: Send a message to Telegram
server.tool(
	"send_telegram_message",
	{
		message: z.string().describe("Message to send to Telegram"),
	},
	async ({ message }) => {
		if (!bridge) {
			return {
				content: [
					{
						type: "text",
						text: "Telegram bridge is not running. Use start_bridge first.",
					},
				],
				isError: true,
			}
		}

		try {
			await bridge.sendMessage(message)
			return {
				content: [
					{
						type: "text",
						text: "Message sent to Telegram.",
					},
				],
			}
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			}
		}
	},
)

// Start the MCP server
const transport = new StdioServerTransport()
await server.connect(transport)
console.error("Telegram Bridge MCP server running on stdio")

// Handle process signals for graceful shutdown
process.on("SIGINT", async () => {
	if (bridge) {
		await bridge.stop()
	}
	process.exit(0)
})

process.on("SIGTERM", async () => {
	if (bridge) {
		await bridge.stop()
	}
	process.exit(0)
})
