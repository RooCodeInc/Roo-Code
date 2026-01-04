/**
 * ExtensionHost - Loads and runs the Roo Code extension in CLI mode
 *
 * This class is responsible for:
 * 1. Creating the vscode-shim mock
 * 2. Loading the extension bundle via require()
 * 3. Activating the extension
 * 4. Managing bidirectional message flow between CLI and extension
 */

import { EventEmitter } from "events"
import { createRequire } from "module"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import { createVSCodeAPI } from "@roo-code/vscode-shim"

// Get the CLI package root directory (for finding node_modules/@vscode/ripgrep)
// When bundled, import.meta.url points to dist/index.js, so go up to package root
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI_PACKAGE_ROOT = path.resolve(__dirname, "..")

export interface ExtensionHostOptions {
	workspacePath: string
	extensionPath: string
	verbose?: boolean
	quiet?: boolean
	apiKey?: string
	apiProvider?: string
	model?: string
}

interface ExtensionModule {
	activate: (context: unknown) => Promise<unknown>
	deactivate?: () => Promise<void>
}

/**
 * Local interface for webview provider (matches VSCode API)
 */
interface WebviewViewProvider {
	resolveWebviewView?(webviewView: unknown, context: unknown, token: unknown): void | Promise<void>
}

export class ExtensionHost extends EventEmitter {
	private vscode: ReturnType<typeof createVSCodeAPI> | null = null
	private extensionModule: ExtensionModule | null = null
	private extensionAPI: unknown = null
	private webviewProviders: Map<string, WebviewViewProvider> = new Map()
	private options: ExtensionHostOptions
	private isWebviewReady = false
	private pendingMessages: unknown[] = []
	private messageListener: ((message: unknown) => void) | null = null
	private originalConsole: {
		log: typeof console.log
		warn: typeof console.warn
		error: typeof console.error
		debug: typeof console.debug
		info: typeof console.info
	} | null = null
	private originalProcessEmitWarning: typeof process.emitWarning | null = null
	private isWaitingForResponse = false
	// Track seen tool calls to avoid duplicate display
	private seenToolCalls: Set<string> = new Set()
	// Track displayed messages by ts to avoid duplicates and show updates
	private displayedMessages: Map<number, { text: string; partial: boolean }> = new Map()
	// Track streamed content by ts for delta computation
	private streamedContent: Map<number, { text: string; headerShown: boolean }> = new Map()
	// Track message processing for verbose debug output
	private processedMessageCount = 0
	private lastProcessedMessageTs: number | undefined = undefined
	// Track if we're currently streaming a message (to manage newlines)
	private currentlyStreamingTs: number | null = null

	constructor(options: ExtensionHostOptions) {
		super()
		this.options = options
	}

	private log(...args: unknown[]): void {
		if (this.options.verbose) {
			// Use original console if available to avoid quiet mode suppression
			const logFn = this.originalConsole?.log || console.log
			logFn("[ExtensionHost]", ...args)
		}
	}

	/**
	 * Suppress Node.js warnings (like MaxListenersExceededWarning)
	 * This is called regardless of quiet mode to prevent warnings from interrupting output
	 */
	private suppressNodeWarnings(): void {
		// Suppress process warnings (like MaxListenersExceededWarning)
		this.originalProcessEmitWarning = process.emitWarning
		process.emitWarning = () => {}

		// Also suppress via the warning event handler
		process.on("warning", () => {})
	}

	/**
	 * Suppress console output from the extension when quiet mode is enabled.
	 * This intercepts console.log, console.warn, console.info, console.debug
	 * but allows console.error through for critical errors.
	 */
	private setupQuietMode(): void {
		if (!this.options.quiet) return

		// Save original console methods
		this.originalConsole = {
			log: console.log,
			warn: console.warn,
			error: console.error,
			debug: console.debug,
			info: console.info,
		}

		// Replace with no-op functions (except error)
		console.log = () => {}
		console.warn = () => {}
		console.debug = () => {}
		console.info = () => {}
		// Keep console.error for critical errors
	}

	/**
	 * Restore original console methods and process.emitWarning
	 */
	private restoreConsole(): void {
		if (this.originalConsole) {
			console.log = this.originalConsole.log
			console.warn = this.originalConsole.warn
			console.error = this.originalConsole.error
			console.debug = this.originalConsole.debug
			console.info = this.originalConsole.info
			this.originalConsole = null
		}

		if (this.originalProcessEmitWarning) {
			process.emitWarning = this.originalProcessEmitWarning
			this.originalProcessEmitWarning = null
		}
	}

	async activate(): Promise<void> {
		this.log("Activating extension...")

		// Suppress Node.js warnings (like MaxListenersExceededWarning) before anything else
		this.suppressNodeWarnings()

		// Set up quiet mode before loading extension
		this.setupQuietMode()

		// Verify extension path exists
		const bundlePath = path.join(this.options.extensionPath, "extension.js")
		if (!fs.existsSync(bundlePath)) {
			this.restoreConsole()
			throw new Error(`Extension bundle not found at: ${bundlePath}`)
		}

		// 1. Create VSCode API mock
		this.log("Creating VSCode API mock...")
		this.log("Using appRoot:", CLI_PACKAGE_ROOT)
		this.vscode = createVSCodeAPI(
			this.options.extensionPath,
			this.options.workspacePath,
			undefined, // identity
			{ appRoot: CLI_PACKAGE_ROOT }, // options - point appRoot to CLI package for ripgrep
		)

		// 2. Set global vscode reference for the extension
		;(global as Record<string, unknown>).vscode = this.vscode

		// 3. Set up __extensionHost global for webview registration
		// This is used by WindowAPI.registerWebviewViewProvider
		;(global as Record<string, unknown>).__extensionHost = this

		// 4. Set up module resolution to intercept require('vscode')
		const require = createRequire(import.meta.url)
		const Module = require("module")
		const originalResolve = Module._resolveFilename

		Module._resolveFilename = function (request: string, parent: unknown, isMain: boolean, options: unknown) {
			if (request === "vscode") {
				return "vscode-mock"
			}
			return originalResolve.call(this, request, parent, isMain, options)
		}

		// Add the mock to require.cache
		// Use 'as unknown as' to satisfy TypeScript's Module type requirements
		require.cache["vscode-mock"] = {
			id: "vscode-mock",
			filename: "vscode-mock",
			loaded: true,
			exports: this.vscode,
			children: [],
			paths: [],
			path: "",
			isPreloading: false,
			parent: null,
			require: require,
		} as unknown as NodeJS.Module

		this.log("Loading extension bundle from:", bundlePath)

		// 5. Load extension bundle
		try {
			this.extensionModule = require(bundlePath) as ExtensionModule
		} catch (error) {
			// Restore module resolution before throwing
			Module._resolveFilename = originalResolve
			throw new Error(
				`Failed to load extension bundle: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		// 6. Restore module resolution
		Module._resolveFilename = originalResolve

		this.log("Activating extension...")

		// 7. Activate extension
		try {
			this.extensionAPI = await this.extensionModule.activate(this.vscode.context)
			this.log("Extension activated successfully")
		} catch (error) {
			throw new Error(`Failed to activate extension: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Called by WindowAPI.registerWebviewViewProvider
	 * This is triggered when the extension registers its sidebar webview provider
	 */
	registerWebviewProvider(viewId: string, provider: WebviewViewProvider): void {
		this.log(`Webview provider registered: ${viewId}`)
		this.webviewProviders.set(viewId, provider)

		// The WindowAPI will call resolveWebviewView automatically
		// We don't need to do anything here
	}

	/**
	 * Called when a webview provider is disposed
	 */
	unregisterWebviewProvider(viewId: string): void {
		this.log(`Webview provider unregistered: ${viewId}`)
		this.webviewProviders.delete(viewId)
	}

	/**
	 * Returns true during initial extension setup
	 * Used to prevent the extension from aborting tasks during initialization
	 */
	isInInitialSetup(): boolean {
		return !this.isWebviewReady
	}

	/**
	 * Called by WindowAPI after resolveWebviewView completes
	 * This indicates the webview is ready to receive messages
	 */
	markWebviewReady(): void {
		this.log("Webview marked as ready")
		this.isWebviewReady = true
		this.emit("webviewReady")

		// Flush any pending messages
		this.flushPendingMessages()
	}

	/**
	 * Send any messages that were queued before the webview was ready
	 */
	private flushPendingMessages(): void {
		if (this.pendingMessages.length > 0) {
			this.log(`Flushing ${this.pendingMessages.length} pending messages`)
			for (const message of this.pendingMessages) {
				this.emit("webviewMessage", message)
			}
			this.pendingMessages = []
		}
	}

	/**
	 * Send a message to the extension (simulating webview -> extension communication)
	 */
	sendToExtension(message: unknown): void {
		if (!this.isWebviewReady) {
			this.log("Queueing message (webview not ready):", message)
			this.pendingMessages.push(message)
			return
		}

		this.log("Sending message to extension:", message)
		this.emit("webviewMessage", message)
	}

	/**
	 * Build the provider-specific API configuration
	 * Each provider uses different field names for API key and model
	 */
	private buildApiConfiguration(): Record<string, unknown> {
		const provider = this.options.apiProvider || "anthropic"
		const apiKey = this.options.apiKey
		const model = this.options.model

		// Base config with provider
		const config: Record<string, unknown> = {
			apiProvider: provider,
		}

		// Map provider to the correct API key and model field names
		// Based on packages/types/src/provider-settings.ts
		switch (provider) {
			case "anthropic":
				if (apiKey) config.apiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "openrouter":
				if (apiKey) config.openRouterApiKey = apiKey
				if (model) config.openRouterModelId = model
				// Enable reasoning/thinking for models that support it
				config.enableReasoningEffort = true
				config.reasoningEffort = "medium"
				break

			case "gemini":
				if (apiKey) config.geminiApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "openai-native":
				if (apiKey) config.openAiNativeApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "openai":
				if (apiKey) config.openAiApiKey = apiKey
				if (model) config.openAiModelId = model
				break

			case "mistral":
				if (apiKey) config.mistralApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "deepseek":
				if (apiKey) config.deepSeekApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "xai":
				if (apiKey) config.xaiApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "groq":
				if (apiKey) config.groqApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "fireworks":
				if (apiKey) config.fireworksApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "cerebras":
				if (apiKey) config.cerebrasApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "sambanova":
				if (apiKey) config.sambaNovaApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "ollama":
				if (apiKey) config.ollamaApiKey = apiKey
				if (model) config.ollamaModelId = model
				break

			case "lmstudio":
				if (model) config.lmStudioModelId = model
				break

			case "litellm":
				if (apiKey) config.litellmApiKey = apiKey
				if (model) config.litellmModelId = model
				break

			case "huggingface":
				if (apiKey) config.huggingFaceApiKey = apiKey
				if (model) config.huggingFaceModelId = model
				break

			case "chutes":
				if (apiKey) config.chutesApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "featherless":
				if (apiKey) config.featherlessApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "unbound":
				if (apiKey) config.unboundApiKey = apiKey
				if (model) config.unboundModelId = model
				break

			case "requesty":
				if (apiKey) config.requestyApiKey = apiKey
				if (model) config.requestyModelId = model
				break

			case "deepinfra":
				if (apiKey) config.deepInfraApiKey = apiKey
				if (model) config.deepInfraModelId = model
				break

			case "vercel-ai-gateway":
				if (apiKey) config.vercelAiGatewayApiKey = apiKey
				if (model) config.vercelAiGatewayModelId = model
				break

			case "zai":
				if (apiKey) config.zaiApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "baseten":
				if (apiKey) config.basetenApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "doubao":
				if (apiKey) config.doubaoApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "moonshot":
				if (apiKey) config.moonshotApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "minimax":
				if (apiKey) config.minimaxApiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "io-intelligence":
				if (apiKey) config.ioIntelligenceApiKey = apiKey
				if (model) config.ioIntelligenceModelId = model
				break

			default:
				// Default to apiKey and apiModelId for unknown providers
				if (apiKey) config.apiKey = apiKey
				if (model) config.apiModelId = model
		}

		return config
	}

	/**
	 * Run a task with the given prompt
	 */
	async runTask(prompt: string): Promise<void> {
		this.log("Running task:", prompt)

		// Wait for webview to be ready
		if (!this.isWebviewReady) {
			this.log("Waiting for webview to be ready...")
			await new Promise<void>((resolve) => {
				this.once("webviewReady", resolve)
			})
		}

		// Set up message listener for extension responses
		this.setupMessageListener()

		// Inject auto-approval settings first (so tools execute without prompts)
		this.log("Injecting auto-approval settings...")
		this.sendToExtension({
			type: "updateSettings",
			updatedSettings: {
				autoApprovalEnabled: true,
				alwaysAllowReadOnly: true,
				alwaysAllowReadOnlyOutsideWorkspace: true,
				alwaysAllowWrite: true,
				alwaysAllowWriteOutsideWorkspace: true,
				alwaysAllowWriteProtected: false, // Keep protected files safe
				alwaysAllowBrowser: true,
				alwaysAllowMcp: true,
				alwaysAllowModeSwitch: true,
				alwaysAllowSubtasks: true,
				alwaysAllowExecute: true,
				alwaysAllowFollowupQuestions: true,
				followupAutoApproveTimeoutMs: 0, // Instant approval
				// Enable reasoning/thinking tokens for models that support it
				enableReasoningEffort: true,
				reasoningEffort: "medium",
			},
		})

		// Give the extension a moment to process the settings
		await new Promise<void>((resolve) => setTimeout(resolve, 100))

		// Inject API configuration
		if (this.options.apiKey) {
			this.log("Injecting API configuration...")
			const apiConfiguration = this.buildApiConfiguration()
			// The upsertApiConfiguration message expects:
			// - text: the profile name
			// - apiConfiguration: the config object with provider-specific field names
			this.sendToExtension({
				type: "upsertApiConfiguration",
				text: "cli-config", // Profile name
				apiConfiguration,
			})

			// Give the extension a moment to process the config
			await new Promise<void>((resolve) => setTimeout(resolve, 100))
		}

		// Mark that we're waiting for response
		this.isWaitingForResponse = true

		// Send the task message
		// This matches the WebviewMessage type from the extension
		this.sendToExtension({
			type: "newTask",
			text: prompt,
		})

		// Wait for task completion
		await this.waitForCompletion()
	}

	/**
	 * Set up listener for messages from the extension
	 */
	private setupMessageListener(): void {
		this.messageListener = (message: unknown) => {
			this.handleExtensionMessage(message)
		}

		this.on("extensionWebviewMessage", this.messageListener)
	}

	/**
	 * Handle messages from the extension
	 */
	private handleExtensionMessage(message: unknown): void {
		const msg = message as Record<string, unknown>

		if (this.options.verbose) {
			this.log("Received message from extension:", JSON.stringify(msg, null, 2))
		}

		// Handle different message types
		switch (msg.type) {
			case "state":
				this.handleStateMessage(msg)
				break

			case "messageUpdated":
				// This is the streaming update - handle individual message updates
				this.handleMessageUpdated(msg)
				break

			case "action":
				this.handleActionMessage(msg)
				break

			case "invoke":
				this.handleInvokeMessage(msg)
				break

			default:
				// Log unknown message types in verbose mode
				if (this.options.verbose) {
					this.log("Unknown message type:", msg.type)
				}
		}
	}

	/**
	 * Get console.log that bypasses quiet mode suppression
	 */
	private getOutputLog(): typeof console.log {
		return this.originalConsole?.log || console.log
	}

	/**
	 * Get console.error that bypasses quiet mode suppression
	 */
	private getOutputError(): typeof console.error {
		return this.originalConsole?.error || console.error
	}

	/**
	 * Handle state update messages from the extension
	 */
	private handleStateMessage(msg: Record<string, unknown>): void {
		const state = msg.state as Record<string, unknown> | undefined
		if (!state) return

		const clineMessages = state.clineMessages as Array<Record<string, unknown>> | undefined

		if (clineMessages && clineMessages.length > 0) {
			// Use original console methods to bypass quiet mode for user-facing output
			const log = this.getOutputLog()
			const error = this.getOutputError()

			// Track message processing for verbose debug output
			this.processedMessageCount++

			// Verbose: log state update summary
			if (this.options.verbose) {
				this.log(`State update #${this.processedMessageCount}: ${clineMessages.length} messages`)
			}

			// Process all messages to find new or updated ones
			for (const message of clineMessages) {
				if (!message) continue

				const ts = message.ts as number | undefined
				const isPartial = message.partial as boolean | undefined
				const text = message.text as string
				const type = message.type as string
				const say = message.say as string | undefined
				const ask = message.ask as string | undefined

				if (!ts) continue

				// Handle "say" type messages
				if (type === "say" && say) {
					this.handleSayMessage(ts, say, text, isPartial, log, error)
				}
				// Handle "ask" type messages
				else if (type === "ask" && ask) {
					this.handleAskMessage(ts, ask, text, isPartial, log)
				}
			}
		}
	}

	/**
	 * Handle messageUpdated - individual streaming updates for a single message
	 * This is where real-time streaming happens!
	 */
	private handleMessageUpdated(msg: Record<string, unknown>): void {
		const clineMessage = msg.clineMessage as Record<string, unknown> | undefined
		if (!clineMessage) return

		const ts = clineMessage.ts as number | undefined
		const isPartial = clineMessage.partial as boolean | undefined
		const text = clineMessage.text as string
		const type = clineMessage.type as string
		const say = clineMessage.say as string | undefined
		const ask = clineMessage.ask as string | undefined

		if (!ts) return

		// Use original console methods to bypass quiet mode for user-facing output
		const log = this.getOutputLog()
		const error = this.getOutputError()

		// Handle "say" type messages
		if (type === "say" && say) {
			this.handleSayMessage(ts, say, text, isPartial, log, error)
		}
		// Handle "ask" type messages
		else if (type === "ask" && ask) {
			this.handleAskMessage(ts, ask, text, isPartial, log)
		}
	}

	/**
	 * Write streaming output directly to stdout (bypassing quiet mode if needed)
	 */
	private writeStream(text: string): void {
		process.stdout.write(text)
	}

	/**
	 * Stream content with delta computation - only output new characters
	 */
	private streamContent(ts: number, text: string, header: string): void {
		const previous = this.streamedContent.get(ts)

		if (!previous) {
			// First time seeing this message - output header and initial text
			this.writeStream(`\n${header} `)
			this.writeStream(text)
			this.streamedContent.set(ts, { text, headerShown: true })
			this.currentlyStreamingTs = ts
		} else if (text.length > previous.text.length && text.startsWith(previous.text)) {
			// Text has grown - output delta
			const delta = text.slice(previous.text.length)
			this.writeStream(delta)
			this.streamedContent.set(ts, { text, headerShown: true })
		}
	}

	/**
	 * Finish streaming a message (add newline)
	 */
	private finishStream(ts: number): void {
		if (this.currentlyStreamingTs === ts) {
			this.writeStream("\n")
			this.currentlyStreamingTs = null
		}
	}

	/**
	 * Handle "say" type messages
	 */
	private handleSayMessage(
		ts: number,
		say: string,
		text: string,
		isPartial: boolean | undefined,
		log: typeof console.log,
		error: typeof console.error,
	): void {
		const previousDisplay = this.displayedMessages.get(ts)
		const alreadyDisplayedComplete = previousDisplay && !previousDisplay.partial

		switch (say) {
			case "text":
				// Skip the initial user prompt echo (first message with no prior messages)
				if (this.displayedMessages.size === 0 && !previousDisplay) {
					this.displayedMessages.set(ts, { text, partial: !!isPartial })
					break
				}

				if (isPartial && text) {
					// Stream partial content
					this.streamContent(ts, text, "[Assistant]")
					this.displayedMessages.set(ts, { text, partial: true })
				} else if (!isPartial && text && !alreadyDisplayedComplete) {
					// Message complete - ensure all content is output
					const streamed = this.streamedContent.get(ts)
					if (streamed) {
						// We were streaming - output any remaining delta and finish
						if (text.length > streamed.text.length && text.startsWith(streamed.text)) {
							const delta = text.slice(streamed.text.length)
							this.writeStream(delta)
						}
						this.finishStream(ts)
					} else {
						// Not streamed yet - output complete message
						log("\n[Assistant]", text)
					}
					this.displayedMessages.set(ts, { text, partial: false })
					this.streamedContent.set(ts, { text, headerShown: true })
				}
				break

			case "thinking":
			case "reasoning":
				// Stream reasoning content in real-time
				if (isPartial && text) {
					this.streamContent(ts, text, "[reasoning]")
					this.displayedMessages.set(ts, { text, partial: true })
				} else if (!isPartial && text && !alreadyDisplayedComplete) {
					// Reasoning complete - finish the stream
					const streamed = this.streamedContent.get(ts)
					if (streamed) {
						if (text.length > streamed.text.length && text.startsWith(streamed.text)) {
							const delta = text.slice(streamed.text.length)
							this.writeStream(delta)
						}
						this.finishStream(ts)
					} else {
						log("\n[reasoning]", text)
					}
					this.displayedMessages.set(ts, { text, partial: false })
				}
				break

			case "command_output":
				// Show command output (usually not partial)
				if (text && !alreadyDisplayedComplete) {
					log("\n[Command Output]", text)
					this.displayedMessages.set(ts, { text, partial: false })
				}
				break

			case "completion_result":
				if (!alreadyDisplayedComplete) {
					this.isWaitingForResponse = false
					log("\n[Task Complete]", text || "")
					this.displayedMessages.set(ts, { text: text || "", partial: false })
					this.emit("taskComplete")
				}
				break

			case "error":
				if (!alreadyDisplayedComplete) {
					this.isWaitingForResponse = false
					error("\n[Error]", text || "Unknown error")
					this.displayedMessages.set(ts, { text: text || "", partial: false })
					this.emit("taskError", text)
				}
				break

			case "tool":
				// Tool usage - show when complete
				if (text && !alreadyDisplayedComplete) {
					log("\n[Tool]", text)
					this.displayedMessages.set(ts, { text, partial: false })
				}
				break

			case "api_req_started":
				// API request started - no action needed
				break

			default:
				// Other say types - show in verbose mode
				if (this.options.verbose && text && !alreadyDisplayedComplete) {
					log(`\n[${say}]`, text || "")
					this.displayedMessages.set(ts, { text: text || "", partial: false })
				}
		}
	}

	/**
	 * Handle "ask" type messages
	 */
	private handleAskMessage(
		ts: number,
		ask: string,
		text: string,
		isPartial: boolean | undefined,
		log: typeof console.log,
	): void {
		const previousDisplay = this.displayedMessages.get(ts)
		const alreadyDisplayedComplete = previousDisplay && !previousDisplay.partial

		switch (ask) {
			case "command":
				if (!alreadyDisplayedComplete) {
					log("\n[Running Command]", text || "")
					this.displayedMessages.set(ts, { text: text || "", partial: false })
				}
				break

			case "command_output":
				// This is asking to show output - no need to display again
				break

			case "tool":
				// Tool call request - parse and display the tool info
				if (text) {
					try {
						const toolInfo = JSON.parse(text)
						const toolName = toolInfo.tool || "unknown"

						// Create a unique key for this tool call - use ts only (not partial state)
						// This ensures each tool call is displayed only once
						const toolCallKey = `${toolName}-${ts}`
						const isDuplicate = this.seenToolCalls.has(toolCallKey)

						// Verbose debug logging for tool calls
						if (this.options.verbose) {
							this.log(
								`Tool call: name=${toolName}, partial=${isPartial}, ` +
									`ts=${ts}, isDuplicate=${isDuplicate}, key=${toolCallKey}`,
							)
						}

						// Only display if not already shown for this ts
						if (!isDuplicate) {
							this.seenToolCalls.add(toolCallKey)
							log(`\n[Tool Call] ${toolName}`)
							// Show key parameters
							if (toolInfo.path) {
								log(`  Path: ${toolInfo.path}`)
							}
							if (toolInfo.content) {
								const preview =
									toolInfo.content.length > 100
										? toolInfo.content.substring(0, 100) + "..."
										: toolInfo.content
								log(`  Content: ${preview}`)
							}
						}
					} catch {
						// If not JSON, just show the text
						if (!alreadyDisplayedComplete) {
							log("\n[Tool Call]", text)
							this.displayedMessages.set(ts, { text, partial: false })
						}
					}
				}
				break

			default:
				// Other ask types - show what's being asked
				if (text && !alreadyDisplayedComplete) {
					log("\n[Assistant asks]", text)
					this.displayedMessages.set(ts, { text, partial: false })
				}
		}

		// Auto-approval is handled by extension settings (configured in runTask)
		// The extension will automatically approve based on alwaysAllow* settings
	}

	/**
	 * Handle action messages
	 */
	private handleActionMessage(msg: Record<string, unknown>): void {
		const action = msg.action as string

		if (this.options.verbose) {
			this.log("Action:", action)
		}
	}

	/**
	 * Handle invoke messages
	 */
	private handleInvokeMessage(msg: Record<string, unknown>): void {
		const invoke = msg.invoke as string

		if (this.options.verbose) {
			this.log("Invoke:", invoke)
		}
	}

	/**
	 * Wait for the task to complete
	 */
	private waitForCompletion(): Promise<void> {
		return new Promise((resolve, reject) => {
			const completeHandler = () => {
				cleanup()
				resolve()
			}

			const errorHandler = (error: string) => {
				cleanup()
				reject(new Error(error))
			}

			const cleanup = () => {
				this.off("taskComplete", completeHandler)
				this.off("taskError", errorHandler)
			}

			this.once("taskComplete", completeHandler)
			this.once("taskError", errorHandler)

			// Set a timeout (10 minutes by default)
			const timeout = setTimeout(
				() => {
					cleanup()
					reject(new Error("Task timed out"))
				},
				10 * 60 * 1000,
			)

			// Clear timeout on completion
			this.once("taskComplete", () => clearTimeout(timeout))
			this.once("taskError", () => clearTimeout(timeout))
		})
	}

	/**
	 * Clean up resources
	 */
	async dispose(): Promise<void> {
		this.log("Disposing extension host...")

		// Reset waiting state
		this.isWaitingForResponse = false

		// Remove message listener
		if (this.messageListener) {
			this.off("extensionWebviewMessage", this.messageListener)
			this.messageListener = null
		}

		// Deactivate extension if it has a deactivate function
		if (this.extensionModule?.deactivate) {
			try {
				await this.extensionModule.deactivate()
			} catch (error) {
				this.log("Error deactivating extension:", error)
			}
		}

		// Clear references
		this.vscode = null
		this.extensionModule = null
		this.extensionAPI = null
		this.webviewProviders.clear()

		// Clear globals
		delete (global as Record<string, unknown>).vscode
		delete (global as Record<string, unknown>).__extensionHost

		// Restore console if it was suppressed
		this.restoreConsole()

		this.log("Extension host disposed")
	}
}
