/**
 * TelegramBridge - Handles communication between Roo Code and Telegram
 *
 * This class connects to Roo Code via IPC and manages a Telegram bot
 * to forward messages and handle user interactions.
 */

import TelegramBot from "node-telegram-bot-api"
import { IpcClient } from "@roo-code/ipc"
import { IpcMessageType, RooCodeEventName, TaskCommandName } from "@roo-code/types"
import type { ClineMessage, TaskEvent } from "@roo-code/types"

import { formatMessageForTelegram, truncateMessage } from "./message-formatter.js"

export interface TelegramBridgeOptions {
	botToken: string
	chatId: string
	socketPath?: string
	enableTts?: boolean
}

export interface BridgeStatus {
	running: boolean
	connected: boolean
	botUsername?: string
	chatId: string
	messagesSent: number
	messagesReceived: number
	lastError?: string
}

// Callback data format: action:taskId
const CALLBACK_APPROVE = "approve"
const CALLBACK_DENY = "deny"

export class TelegramBridge {
	private readonly options: TelegramBridgeOptions
	private bot: TelegramBot | null = null
	private ipcClient: IpcClient | null = null
	private running = false
	private botUsername?: string
	private messagesSent = 0
	private messagesReceived = 0
	private lastError?: string
	private pendingApprovals: Map<string, { messageId: number; taskId: string }> = new Map()

	constructor(options: TelegramBridgeOptions) {
		if (!options.botToken) {
			throw new Error("Telegram bot token is required")
		}
		if (!options.chatId) {
			throw new Error("Telegram chat ID is required")
		}
		this.options = options
	}

	async start(): Promise<void> {
		if (this.running) {
			return
		}

		try {
			// Initialize Telegram bot
			this.bot = new TelegramBot(this.options.botToken, { polling: true })

			// Get bot info
			const me = await this.bot.getMe()
			this.botUsername = me.username

			// Set up bot event handlers
			this.setupBotHandlers()

			// Connect to Roo Code IPC
			const socketPath = this.options.socketPath || this.getDefaultSocketPath()
			this.ipcClient = new IpcClient(socketPath, console.error)

			// Set up IPC event handlers
			this.setupIpcHandlers()

			this.running = true

			// Send startup message
			await this.sendMessage("🤖 Roo Code Telegram Bridge connected! You can now control Roo Code remotely.")
		} catch (error) {
			this.lastError = error instanceof Error ? error.message : String(error)
			throw error
		}
	}

	async stop(): Promise<void> {
		if (!this.running) {
			return
		}

		try {
			// Send shutdown message
			await this.sendMessage("👋 Roo Code Telegram Bridge disconnected.")
		} catch {
			// Ignore errors when sending shutdown message
		}

		if (this.bot) {
			this.bot.stopPolling()
			this.bot = null
		}

		if (this.ipcClient) {
			this.ipcClient.disconnect()
			this.ipcClient = null
		}

		this.running = false
		this.pendingApprovals.clear()
	}

	getStatus(): BridgeStatus {
		return {
			running: this.running,
			connected: this.ipcClient?.isConnected ?? false,
			botUsername: this.botUsername,
			chatId: this.options.chatId,
			messagesSent: this.messagesSent,
			messagesReceived: this.messagesReceived,
			lastError: this.lastError,
		}
	}

	async sendMessage(text: string, options?: TelegramBot.SendMessageOptions): Promise<TelegramBot.Message | null> {
		if (!this.bot || !this.running) {
			return null
		}

		try {
			const message = await this.bot.sendMessage(this.options.chatId, text, {
				parse_mode: "HTML",
				...options,
			})
			this.messagesSent++
			return message
		} catch (error) {
			this.lastError = error instanceof Error ? error.message : String(error)
			console.error("Failed to send Telegram message:", error)
			return null
		}
	}

	private getDefaultSocketPath(): string {
		const platform = process.platform
		if (platform === "win32") {
			return "\\\\.\\pipe\\roo-code-ipc"
		}
		// macOS and Linux
		const tmpDir = process.env.TMPDIR || process.env.TMP || "/tmp"
		return `${tmpDir}/roo-code-ipc.sock`
	}

	private setupBotHandlers(): void {
		if (!this.bot) return

		// Handle incoming messages
		this.bot.on("message", async (msg) => {
			if (msg.chat.id.toString() !== this.options.chatId) {
				// Ignore messages from other chats
				return
			}

			this.messagesReceived++

			const text = msg.text?.trim()
			if (!text) return

			// Handle commands
			if (text.startsWith("/")) {
				await this.handleCommand(text)
				return
			}

			// Forward message to Roo Code as a new instruction
			if (this.ipcClient?.isReady) {
				this.ipcClient.sendTaskMessage(text)
				await this.sendMessage("📤 Message sent to Roo Code")
			} else {
				await this.sendMessage("❌ Not connected to Roo Code")
			}
		})

		// Handle callback queries (button clicks)
		this.bot.on("callback_query", async (query) => {
			if (!query.data || !query.message) return

			const [action, approvalId] = query.data.split(":")

			if (action === CALLBACK_APPROVE) {
				await this.handleApproval(approvalId, true, query.message.message_id)
				await this.bot?.answerCallbackQuery(query.id, { text: "✅ Approved" })
			} else if (action === CALLBACK_DENY) {
				await this.handleApproval(approvalId, false, query.message.message_id)
				await this.bot?.answerCallbackQuery(query.id, { text: "❌ Denied" })
			}
		})

		// Handle polling errors
		this.bot.on("polling_error", (error) => {
			this.lastError = error.message
			console.error("Telegram polling error:", error)
		})
	}

	private async handleCommand(text: string): Promise<void> {
		const [command, ...args] = text.split(" ")

		switch (command.toLowerCase()) {
			case "/start":
			case "/help":
				await this.sendMessage(
					"🤖 <b>Roo Code Telegram Bridge</b>\n\n" +
						"<b>Commands:</b>\n" +
						"/status - Show connection status\n" +
						"/cancel - Cancel current task\n" +
						"/help - Show this help message\n\n" +
						"<b>Usage:</b>\n" +
						"• Send any message to forward it as an instruction to Roo Code\n" +
						"• Use the Approve/Deny buttons when prompted for tool operations",
				)
				break

			case "/status":
				const status = this.getStatus()
				await this.sendMessage(
					`📊 <b>Bridge Status</b>\n\n` +
						`Running: ${status.running ? "✅" : "❌"}\n` +
						`Connected: ${status.connected ? "✅" : "❌"}\n` +
						`Messages Sent: ${status.messagesSent}\n` +
						`Messages Received: ${status.messagesReceived}` +
						(status.lastError ? `\nLast Error: ${status.lastError}` : ""),
				)
				break

			case "/cancel":
				if (this.ipcClient?.isReady) {
					// Send cancel command
					this.ipcClient.sendCommand({
						commandName: TaskCommandName.CancelTask,
						data: "", // Current task
					})
					await this.sendMessage("⏹️ Cancel request sent")
				} else {
					await this.sendMessage("❌ Not connected to Roo Code")
				}
				break

			default:
				await this.sendMessage(`❓ Unknown command: ${command}\nUse /help for available commands.`)
		}
	}

	private async handleApproval(approvalId: string, approved: boolean, messageId: number): Promise<void> {
		const approval = this.pendingApprovals.get(approvalId)
		if (!approval) {
			return
		}

		// Remove from pending
		this.pendingApprovals.delete(approvalId)

		// Send approval/denial to Roo Code
		if (this.ipcClient?.isReady) {
			if (approved) {
				this.ipcClient.approveAsk()
			} else {
				this.ipcClient.denyAsk()
			}
		}

		// Update the message to show the decision
		const statusText = approved ? "✅ APPROVED" : "❌ DENIED"
		try {
			await this.bot?.editMessageReplyMarkup(
				{ inline_keyboard: [] },
				{
					chat_id: this.options.chatId,
					message_id: messageId,
				},
			)
			await this.bot?.editMessageText(`${statusText}`, {
				chat_id: this.options.chatId,
				message_id: messageId,
				parse_mode: "HTML",
			})
		} catch (error) {
			// Ignore edit errors
		}
	}

	private setupIpcHandlers(): void {
		if (!this.ipcClient) return

		this.ipcClient.on(IpcMessageType.Connect, () => {
			console.log("Connected to Roo Code IPC")
		})

		this.ipcClient.on(IpcMessageType.Disconnect, () => {
			console.log("Disconnected from Roo Code IPC")
			this.sendMessage("⚠️ Lost connection to Roo Code")
		})

		this.ipcClient.on(IpcMessageType.Ack, (data) => {
			console.log("IPC handshake complete:", data.clientId)
			this.sendMessage("✅ Connected to Roo Code")
		})

		this.ipcClient.on(IpcMessageType.TaskEvent, async (event) => {
			await this.handleTaskEvent(event)
		})
	}

	private async handleTaskEvent(event: TaskEvent): Promise<void> {
		switch (event.eventName) {
			case RooCodeEventName.TaskStarted:
				await this.sendMessage("🚀 <b>Task Started</b>")
				break

			case RooCodeEventName.TaskCompleted:
				await this.sendMessage("✅ <b>Task Completed</b>")
				break

			case RooCodeEventName.TaskAborted:
				await this.sendMessage("⏹️ <b>Task Aborted</b>")
				break

			case RooCodeEventName.TaskInteractive:
				// Task needs user interaction - this is handled by the Message event
				break

			case RooCodeEventName.Message:
				const [messageData] = event.payload as [{ action: "created" | "updated"; message: ClineMessage }]
				await this.handleClineMessage(messageData)
				break

			case RooCodeEventName.TaskModeSwitched:
				const [taskId, mode] = event.payload as [string, string]
				await this.sendMessage(`🔄 Mode switched to: <b>${mode}</b>`)
				break
		}
	}

	private async handleClineMessage(messageData: { action: string; message: ClineMessage }): Promise<void> {
		const { action, message } = messageData

		// Only handle new messages
		if (action !== "created") {
			return
		}

		// Format the message for Telegram
		const formattedMessage = formatMessageForTelegram(message)

		if (message.type === "ask" && message.ask) {
			// This is an approval request
			const approvalId = `${Date.now()}-${Math.random().toString(36).substring(7)}`

			const sentMessage = await this.sendMessage(formattedMessage, {
				reply_markup: {
					inline_keyboard: [
						[
							{ text: "✅ Approve", callback_data: `${CALLBACK_APPROVE}:${approvalId}` },
							{ text: "❌ Deny", callback_data: `${CALLBACK_DENY}:${approvalId}` },
						],
					],
				},
			})

			if (sentMessage) {
				this.pendingApprovals.set(approvalId, {
					messageId: sentMessage.message_id,
					taskId: String(message.ts),
				})
			}
		} else if (message.type === "say" && message.text) {
			// This is an informational message
			await this.sendMessage(formattedMessage)
		}
	}
}
