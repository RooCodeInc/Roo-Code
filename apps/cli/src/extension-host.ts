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
import readline from "readline"

import { createVSCodeAPI, setRuntimeConfigValues } from "@roo-code/vscode-shim"
import { ProviderName, ReasoningEffortExtended, RooCodeSettings } from "@roo-code/types"

// Get the CLI package root directory (for finding node_modules/@vscode/ripgrep)
// When bundled, import.meta.url points to dist/index.js, so go up to package root
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI_PACKAGE_ROOT = path.resolve(__dirname, "..")

export interface ExtensionHostOptions {
	mode: string
	reasoningEffort?: ReasoningEffortExtended | "disabled"
	apiProvider: ProviderName
	apiKey?: string
	model: string
	workspacePath: string
	extensionPath: string
	verbose?: boolean
	quiet?: boolean
	nonInteractive?: boolean
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

	// Track pending asks that need a response (by ts)
	private pendingAsks: Set<number> = new Set()

	// Readline interface for interactive prompts
	private rl: readline.Interface | null = null

	// Track displayed messages by ts to avoid duplicates and show updates
	private displayedMessages: Map<number, { text: string; partial: boolean }> = new Map()

	// Track streamed content by ts for delta computation
	private streamedContent: Map<number, { text: string; headerShown: boolean }> = new Map()

	// Track message processing for verbose debug output
	private processedMessageCount = 0

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
		if (!this.options.quiet) {
			return
		}

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
	 * Send a message to the extension (simulating webview -> extension communication).
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

	private applyRuntimeSettings(settings: RooCodeSettings): void {
		if (this.options.mode) {
			settings.mode = this.options.mode
		}

		if (this.options.reasoningEffort) {
			if (this.options.reasoningEffort === "disabled") {
				settings.enableReasoningEffort = false
			} else {
				settings.enableReasoningEffort = true
				settings.reasoningEffort = this.options.reasoningEffort
			}
		}

		// Update vscode-shim runtime configuration so
		// vscode.workspace.getConfiguration() returns correct values.
		setRuntimeConfigValues("roo-cline", settings as Record<string, unknown>)
	}

	/**
	 * Build the provider-specific API configuration
	 * Each provider uses different field names for API key and model
	 */
	private buildApiConfiguration(): RooCodeSettings {
		const provider = this.options.apiProvider || "anthropic"
		const apiKey = this.options.apiKey
		const model = this.options.model

		// Base config with provider.
		const config: RooCodeSettings = { apiProvider: provider }

		// Map provider to the correct API key and model field names.
		switch (provider) {
			case "anthropic":
				if (apiKey) config.apiKey = apiKey
				if (model) config.apiModelId = model
				break

			case "openrouter":
				if (apiKey) config.openRouterApiKey = apiKey
				if (model) config.openRouterModelId = model
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
				// Default to apiKey and apiModelId for unknown providers.
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

		// Configure approval settings based on mode
		// In non-interactive mode (-y flag), enable auto-approval for everything
		// In interactive mode (default), we'll prompt the user for each action
		if (this.options.nonInteractive) {
			this.log("Non-interactive mode: enabling auto-approval settings...")

			const settings: RooCodeSettings = {
				autoApprovalEnabled: true,
				alwaysAllowReadOnly: true,
				alwaysAllowReadOnlyOutsideWorkspace: true,
				alwaysAllowWrite: true,
				alwaysAllowWriteOutsideWorkspace: true,
				alwaysAllowWriteProtected: false, // Keep protected files safe.
				alwaysAllowBrowser: true,
				alwaysAllowMcp: true,
				alwaysAllowModeSwitch: true,
				alwaysAllowSubtasks: true,
				alwaysAllowExecute: true,
				alwaysAllowFollowupQuestions: true,
				// Allow all commands with wildcard (required for command auto-approval).
				allowedCommands: ["*"],
				commandExecutionTimeout: 20,
			}

			this.applyRuntimeSettings(settings)
			this.sendToExtension({ type: "updateSettings", updatedSettings: settings })
			await new Promise<void>((resolve) => setTimeout(resolve, 100))
		} else {
			this.log("Interactive mode: user will be prompted for approvals...")
			const settings: RooCodeSettings = { autoApprovalEnabled: false }
			this.applyRuntimeSettings(settings)
			this.sendToExtension({ type: "updateSettings", updatedSettings: settings })
			await new Promise<void>((resolve) => setTimeout(resolve, 100))
		}

		if (this.options.apiKey) {
			this.sendToExtension({ type: "updateSettings", updatedSettings: this.buildApiConfiguration() })
			await new Promise<void>((resolve) => setTimeout(resolve, 100))
		}

		this.sendToExtension({ type: "newTask", text: prompt })
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
	 * Output a message to the user (bypasses quiet mode)
	 * Use this for all user-facing output instead of console.log
	 */
	private output(...args: unknown[]): void {
		const text = args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ")
		process.stdout.write(text + "\n")
	}

	/**
	 * Output an error message to the user (bypasses quiet mode)
	 * Use this for all user-facing errors instead of console.error
	 */
	private outputError(...args: unknown[]): void {
		const text = args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ")
		process.stderr.write(text + "\n")
	}

	/**
	 * Handle state update messages from the extension
	 */
	private handleStateMessage(msg: Record<string, unknown>): void {
		const state = msg.state as Record<string, unknown> | undefined
		if (!state) return

		const clineMessages = state.clineMessages as Array<Record<string, unknown>> | undefined

		if (clineMessages && clineMessages.length > 0) {
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
					this.handleSayMessage(ts, say, text, isPartial)
				}
				// Handle "ask" type messages
				else if (type === "ask" && ask) {
					this.handleAskMessage(ts, ask, text, isPartial)
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

		// Handle "say" type messages
		if (type === "say" && say) {
			this.handleSayMessage(ts, say, text, isPartial)
		}
		// Handle "ask" type messages
		else if (type === "ask" && ask) {
			this.handleAskMessage(ts, ask, text, isPartial)
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
	private handleSayMessage(ts: number, say: string, text: string, isPartial: boolean | undefined): void {
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
					this.streamContent(ts, text, "[assistant]")
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
						this.output("\n[assistant]", text)
					}
					this.displayedMessages.set(ts, { text, partial: false })
					this.streamedContent.set(ts, { text, headerShown: true })
				}
				break

			case "thinking":
			case "reasoning":
				// Stream reasoning content in real-time.
				this.log(`Received ${say} message: partial=${isPartial}, textLength=${text?.length ?? 0}`)
				if (isPartial && text) {
					this.streamContent(ts, text, "[reasoning]")
					this.displayedMessages.set(ts, { text, partial: true })
				} else if (!isPartial && text && !alreadyDisplayedComplete) {
					// Reasoning complete - finish the stream.
					const streamed = this.streamedContent.get(ts)
					if (streamed) {
						if (text.length > streamed.text.length && text.startsWith(streamed.text)) {
							const delta = text.slice(streamed.text.length)
							this.writeStream(delta)
						}
						this.finishStream(ts)
					} else {
						this.output("\n[reasoning]", text)
					}
					this.displayedMessages.set(ts, { text, partial: false })
				}
				break

			case "command_output":
				// Stream command output in real-time.
				if (isPartial && text) {
					this.streamContent(ts, text, "[command output]")
					this.displayedMessages.set(ts, { text, partial: true })
				} else if (!isPartial && text && !alreadyDisplayedComplete) {
					// Command output complete - finish the stream.
					const streamed = this.streamedContent.get(ts)
					if (streamed) {
						if (text.length > streamed.text.length && text.startsWith(streamed.text)) {
							const delta = text.slice(streamed.text.length)
							this.writeStream(delta)
						}
						this.finishStream(ts)
					} else {
						this.writeStream("\n[command output] ")
						this.writeStream(text)
						this.writeStream("\n")
					}
					this.displayedMessages.set(ts, { text, partial: false })
				}
				break

			case "completion_result":
				// Only process when message is complete (not partial)
				if (!isPartial && !alreadyDisplayedComplete) {
					this.output("\n[task complete]", text || "")
					this.displayedMessages.set(ts, { text: text || "", partial: false })
					this.emit("taskComplete")
				} else if (isPartial) {
					// Track partial messages but don't output yet - wait for complete message
					this.displayedMessages.set(ts, { text: text || "", partial: true })
				}
				break

			case "error":
				// Display errors to the user but don't terminate the task
				// Errors like command timeouts are informational - the agent should decide what to do next
				if (!alreadyDisplayedComplete) {
					this.outputError("\n[error]", text || "Unknown error")
					this.displayedMessages.set(ts, { text: text || "", partial: false })
				}
				break

			case "tool":
				// Tool usage - show when complete
				if (text && !alreadyDisplayedComplete) {
					this.output("\n[tool]", text)
					this.displayedMessages.set(ts, { text, partial: false })
				}
				break

			case "api_req_started":
				// API request started - log in verbose mode
				if (this.options.verbose) {
					this.log(`API request started: ts=${ts}`)
				}
				break

			default:
				// Other say types - show in verbose mode
				if (this.options.verbose) {
					this.log(`Unknown say type: ${say}, text length: ${text?.length ?? 0}, partial: ${isPartial}`)
					if (text && !alreadyDisplayedComplete) {
						this.output(`\n[${say}]`, text || "")
						this.displayedMessages.set(ts, { text: text || "", partial: false })
					}
				}
		}
	}

	/**
	 * Handle "ask" type messages - these require user responses
	 * In interactive mode: prompt user for input
	 * In non-interactive mode: auto-approve (handled by extension settings)
	 */
	private handleAskMessage(ts: number, ask: string, text: string, isPartial: boolean | undefined): void {
		// Special handling for command_output - stream it in real-time
		// This needs to happen before the isPartial skip
		if (ask === "command_output") {
			this.handleCommandOutputAsk(ts, text, isPartial)
			return
		}

		// Skip partial messages - wait for the complete ask
		if (isPartial) {
			return
		}

		// Check if we already handled this ask
		if (this.pendingAsks.has(ts)) {
			return
		}

		// In non-interactive mode, the extension's auto-approval settings handle everything
		// We just need to display the action being taken
		if (this.options.nonInteractive) {
			this.handleAskMessageNonInteractive(ts, ask, text)
			return
		}

		// Interactive mode - prompt user for input
		this.handleAskMessageInteractive(ts, ask, text)
	}

	/**
	 * Handle ask messages in non-interactive mode
	 * For followup questions: show prompt with 10s timeout, auto-select first option if no input
	 * For everything else: auto-approval handles responses
	 */
	private handleAskMessageNonInteractive(ts: number, ask: string, text: string): void {
		const previousDisplay = this.displayedMessages.get(ts)
		const alreadyDisplayed = !!previousDisplay

		switch (ask) {
			case "followup":
				if (!alreadyDisplayed) {
					// In non-interactive mode, still prompt the user but with a 10s timeout
					// that auto-selects the first option if no input is received
					this.pendingAsks.add(ts)
					this.handleFollowupQuestionWithTimeout(ts, text)
					this.displayedMessages.set(ts, { text, partial: false })
				}
				break

			case "command":
				if (!alreadyDisplayed) {
					this.output("\n[command]", text || "")
					this.displayedMessages.set(ts, { text: text || "", partial: false })
				}
				break

			// Note: command_output is handled separately in handleCommandOutputAsk

			case "tool":
				if (!alreadyDisplayed && text) {
					try {
						const toolInfo = JSON.parse(text)
						const toolName = toolInfo.tool || "unknown"
						this.output(`\n[tool] ${toolName}`)
						// Display all tool parameters (excluding 'tool' which is the name)
						for (const [key, value] of Object.entries(toolInfo)) {
							if (key === "tool") continue
							// Format the value - truncate long strings
							let displayValue: string
							if (typeof value === "string") {
								displayValue = value.length > 200 ? value.substring(0, 200) + "..." : value
							} else if (typeof value === "object" && value !== null) {
								const json = JSON.stringify(value)
								displayValue = json.length > 200 ? json.substring(0, 200) + "..." : json
							} else {
								displayValue = String(value)
							}
							this.output(`  ${key}: ${displayValue}`)
						}
					} catch {
						this.output("\n[tool]", text)
					}
					this.displayedMessages.set(ts, { text, partial: false })
				}
				break

			case "browser_action_launch":
				if (!alreadyDisplayed) {
					this.output("\n[browser action]", text || "")
					this.displayedMessages.set(ts, { text: text || "", partial: false })
				}
				break

			case "use_mcp_server":
				if (!alreadyDisplayed) {
					try {
						const mcpInfo = JSON.parse(text)
						this.output(`\n[mcp] ${mcpInfo.server_name || "unknown"}`)
					} catch {
						this.output("\n[mcp]", text || "")
					}
					this.displayedMessages.set(ts, { text: text || "", partial: false })
				}
				break

			case "api_req_failed":
				if (!alreadyDisplayed) {
					this.output("\n[retrying api Request]")
					this.displayedMessages.set(ts, { text: text || "", partial: false })
				}
				break

			case "resume_task":
			case "resume_completed_task":
				if (!alreadyDisplayed) {
					this.output("\n[continuing task]")
					this.displayedMessages.set(ts, { text: text || "", partial: false })
				}
				break

			case "completion_result":
				// Task completion - no action needed
				break

			default:
				if (!alreadyDisplayed && text) {
					this.output(`\n[${ask}]`, text)
					this.displayedMessages.set(ts, { text, partial: false })
				}
		}
	}

	/**
	 * Handle ask messages in interactive mode - prompt user for input
	 */
	private handleAskMessageInteractive(ts: number, ask: string, text: string): void {
		// Mark this ask as pending so we don't handle it again
		this.pendingAsks.add(ts)

		switch (ask) {
			case "followup":
				this.handleFollowupQuestion(ts, text)
				break

			case "command":
				this.handleCommandApproval(ts, text)
				break

			// Note: command_output is handled separately in handleCommandOutputAsk

			case "tool":
				this.handleToolApproval(ts, text)
				break

			case "browser_action_launch":
				this.handleBrowserApproval(ts, text)
				break

			case "use_mcp_server":
				this.handleMcpApproval(ts, text)
				break

			case "api_req_failed":
				this.handleApiFailedRetry(ts, text)
				break

			case "resume_task":
			case "resume_completed_task":
				this.handleResumeTask(ts, ask, text)
				break

			case "completion_result":
				// Task completion - handled by say message, no response needed
				this.pendingAsks.delete(ts)
				break

			default:
				// Unknown ask type - try to handle as yes/no
				this.handleGenericApproval(ts, ask, text)
		}
	}

	/**
	 * Handle followup questions - prompt for text input with suggestions
	 */
	private async handleFollowupQuestion(ts: number, text: string): Promise<void> {
		let question = text
		// Suggestions are objects with { answer: string, mode?: string }
		let suggestions: Array<{ answer: string; mode?: string | null }> = []

		// Parse the followup question JSON
		// Format: { question: "...", suggest: [{ answer: "text", mode: "code" }, ...] }
		try {
			const data = JSON.parse(text)
			question = data.question || text
			suggestions = Array.isArray(data.suggest) ? data.suggest : []
		} catch {
			// Use raw text if not JSON
		}

		this.output("\n[question]", question)

		// Show numbered suggestions
		if (suggestions.length > 0) {
			this.output("\nSuggested answers:")
			suggestions.forEach((suggestion, index) => {
				const suggestionText = suggestion.answer || String(suggestion)
				const modeHint = suggestion.mode ? ` (mode: ${suggestion.mode})` : ""
				this.output(`  ${index + 1}. ${suggestionText}${modeHint}`)
			})
			this.output("")
		}

		try {
			const answer = await this.promptForInput(
				suggestions.length > 0
					? "Enter number (1-" + suggestions.length + ") or type your answer: "
					: "Your answer: ",
			)

			let responseText = answer.trim()

			// Check if user entered a number corresponding to a suggestion
			const num = parseInt(responseText, 10)
			if (!isNaN(num) && num >= 1 && num <= suggestions.length) {
				const selectedSuggestion = suggestions[num - 1]
				if (selectedSuggestion) {
					responseText = selectedSuggestion.answer || String(selectedSuggestion)
					this.output(`Selected: ${responseText}`)
				}
			}

			this.sendFollowupResponse(responseText)
			// Don't delete from pendingAsks - keep it to prevent re-processing
			// if the extension sends another state update before processing our response
		} catch {
			// If prompt fails (e.g., stdin closed), use first suggestion answer or empty
			const firstSuggestion = suggestions.length > 0 ? suggestions[0] : null
			const fallback = firstSuggestion?.answer ?? ""
			this.output(`[Using default: ${fallback || "(empty)"}]`)
			this.sendFollowupResponse(fallback)
		}
		// Note: We intentionally don't delete from pendingAsks here.
		// The ts stays in the set to prevent duplicate handling if the extension
		// sends another state update before it processes our response.
		// The set is cleared when the task completes or the host is disposed.
	}

	/**
	 * Handle followup questions with a timeout (for non-interactive mode)
	 * Shows the prompt but auto-selects the first option after 10 seconds
	 * if the user doesn't type anything. Cancels the timeout on any keypress.
	 */
	private async handleFollowupQuestionWithTimeout(ts: number, text: string): Promise<void> {
		let question = text
		// Suggestions are objects with { answer: string, mode?: string }
		let suggestions: Array<{ answer: string; mode?: string | null }> = []

		// Parse the followup question JSON
		try {
			const data = JSON.parse(text)
			question = data.question || text
			suggestions = Array.isArray(data.suggest) ? data.suggest : []
		} catch {
			// Use raw text if not JSON
		}

		this.output("\n[question]", question)

		// Show numbered suggestions
		if (suggestions.length > 0) {
			this.output("\nSuggested answers:")
			suggestions.forEach((suggestion, index) => {
				const suggestionText = suggestion.answer || String(suggestion)
				const modeHint = suggestion.mode ? ` (mode: ${suggestion.mode})` : ""
				this.output(`  ${index + 1}. ${suggestionText}${modeHint}`)
			})
			this.output("")
		}

		// Default to first suggestion or empty string
		const firstSuggestion = suggestions.length > 0 ? suggestions[0] : null
		const defaultAnswer = firstSuggestion?.answer ?? ""

		try {
			const answer = await this.promptForInputWithTimeout(
				suggestions.length > 0
					? `Enter number (1-${suggestions.length}) or type your answer (auto-select in 10s): `
					: "Your answer (auto-select in 10s): ",
				10000, // 10 second timeout
				defaultAnswer,
			)

			let responseText = answer.trim()

			// Check if user entered a number corresponding to a suggestion
			const num = parseInt(responseText, 10)
			if (!isNaN(num) && num >= 1 && num <= suggestions.length) {
				const selectedSuggestion = suggestions[num - 1]
				if (selectedSuggestion) {
					responseText = selectedSuggestion.answer || String(selectedSuggestion)
					this.output(`Selected: ${responseText}`)
				}
			}

			this.sendFollowupResponse(responseText)
		} catch {
			// If prompt fails, use default
			this.output(`[Using default: ${defaultAnswer || "(empty)"}]`)
			this.sendFollowupResponse(defaultAnswer)
		}
	}

	/**
	 * Prompt user for text input with a timeout
	 * Returns defaultValue if timeout expires before any input
	 * Cancels timeout as soon as any character is typed
	 */
	private promptForInputWithTimeout(prompt: string, timeoutMs: number, defaultValue: string): Promise<string> {
		return new Promise((resolve) => {
			// Temporarily restore console for interactive prompts
			const wasQuiet = this.options.quiet
			if (wasQuiet) {
				this.restoreConsole()
			}

			// Put stdin in raw mode to detect individual keypresses
			const wasRaw = process.stdin.isRaw
			if (process.stdin.isTTY) {
				process.stdin.setRawMode(true)
			}
			process.stdin.resume()

			let inputBuffer = ""
			let timeoutCancelled = false
			let resolved = false

			// Set up the timeout
			const timeout = setTimeout(() => {
				if (!resolved) {
					resolved = true
					cleanup()
					this.output(`\n[Timeout - using default: ${defaultValue || "(empty)"}]`)
					resolve(defaultValue)
				}
			}, timeoutMs)

			// Show the prompt
			process.stdout.write(prompt)

			// Cleanup function
			const cleanup = () => {
				clearTimeout(timeout)
				process.stdin.removeListener("data", onData)
				if (process.stdin.isTTY && wasRaw !== undefined) {
					process.stdin.setRawMode(wasRaw)
				}
				process.stdin.pause()
				if (wasQuiet) {
					this.setupQuietMode()
				}
			}

			// Handle keypress data
			const onData = (data: Buffer) => {
				const char = data.toString()

				// Check for Ctrl+C
				if (char === "\x03") {
					cleanup()
					resolved = true
					this.output("\n[cancelled]")
					resolve(defaultValue)
					return
				}

				// Cancel timeout on first character
				if (!timeoutCancelled) {
					timeoutCancelled = true
					clearTimeout(timeout)
				}

				// Handle Enter key
				if (char === "\r" || char === "\n") {
					if (!resolved) {
						resolved = true
						cleanup()
						process.stdout.write("\n")
						resolve(inputBuffer)
					}
					return
				}

				// Handle Backspace
				if (char === "\x7f" || char === "\b") {
					if (inputBuffer.length > 0) {
						inputBuffer = inputBuffer.slice(0, -1)
						// Erase character on screen: move back, write space, move back
						process.stdout.write("\b \b")
					}
					return
				}

				// Regular character - add to buffer and echo
				inputBuffer += char
				process.stdout.write(char)
			}

			process.stdin.on("data", onData)
		})
	}

	/**
	 * Handle command execution approval
	 */
	private async handleCommandApproval(ts: number, text: string): Promise<void> {
		this.output("\n[command request]")
		this.output(`  Command: ${text || "(no command specified)"}`)

		try {
			const approved = await this.promptForYesNo("Execute this command? (y/n): ")
			this.sendApprovalResponse(approved)
		} catch {
			this.output("[Defaulting to: no]")
			this.sendApprovalResponse(false)
		}
		// Note: Don't delete from pendingAsks - see handleFollowupQuestion comment
	}

	/**
	 * Handle tool execution approval
	 */
	private async handleToolApproval(ts: number, text: string): Promise<void> {
		let toolName = "unknown"
		let toolInfo: Record<string, unknown> = {}

		try {
			toolInfo = JSON.parse(text) as Record<string, unknown>
			toolName = (toolInfo.tool as string) || "unknown"
		} catch {
			// Use raw text if not JSON
		}

		this.output(`\n[Tool Request] ${toolName}`)
		// Display all tool parameters (excluding 'tool' which is the name)
		for (const [key, value] of Object.entries(toolInfo)) {
			if (key === "tool") continue
			// Format the value - truncate long strings
			let displayValue: string
			if (typeof value === "string") {
				displayValue = value.length > 200 ? value.substring(0, 200) + "..." : value
			} else if (typeof value === "object" && value !== null) {
				const json = JSON.stringify(value)
				displayValue = json.length > 200 ? json.substring(0, 200) + "..." : json
			} else {
				displayValue = String(value)
			}
			this.output(`  ${key}: ${displayValue}`)
		}

		try {
			const approved = await this.promptForYesNo("Approve this action? (y/n): ")
			this.sendApprovalResponse(approved)
		} catch {
			this.output("[Defaulting to: no]")
			this.sendApprovalResponse(false)
		}
		// Note: Don't delete from pendingAsks - see handleFollowupQuestion comment
	}

	/**
	 * Handle browser action approval
	 */
	private async handleBrowserApproval(ts: number, text: string): Promise<void> {
		this.output("\n[browser action request]")
		if (text) this.output(`  Action: ${text}`)

		try {
			const approved = await this.promptForYesNo("Allow browser action? (y/n): ")
			this.sendApprovalResponse(approved)
		} catch {
			this.output("[Defaulting to: no]")
			this.sendApprovalResponse(false)
		}
		// Note: Don't delete from pendingAsks - see handleFollowupQuestion comment
	}

	/**
	 * Handle MCP server access approval
	 */
	private async handleMcpApproval(ts: number, text: string): Promise<void> {
		let serverName = "unknown"
		let toolName = ""
		let resourceUri = ""

		try {
			const mcpInfo = JSON.parse(text)
			serverName = mcpInfo.server_name || "unknown"
			if (mcpInfo.type === "use_mcp_tool") {
				toolName = mcpInfo.tool_name || ""
			} else if (mcpInfo.type === "access_mcp_resource") {
				resourceUri = mcpInfo.uri || ""
			}
		} catch {
			// Use raw text if not JSON
		}

		this.output("\n[mcp request]")
		this.output(`  Server: ${serverName}`)
		if (toolName) this.output(`  Tool: ${toolName}`)
		if (resourceUri) this.output(`  Resource: ${resourceUri}`)

		try {
			const approved = await this.promptForYesNo("Allow MCP access? (y/n): ")
			this.sendApprovalResponse(approved)
		} catch {
			this.output("[Defaulting to: no]")
			this.sendApprovalResponse(false)
		}
		// Note: Don't delete from pendingAsks - see handleFollowupQuestion comment
	}

	/**
	 * Handle API request failed - retry prompt
	 */
	private async handleApiFailedRetry(ts: number, text: string): Promise<void> {
		this.output("\n[api request failed]")
		this.output(`  Error: ${text || "Unknown error"}`)

		try {
			const retry = await this.promptForYesNo("Retry the request? (y/n): ")
			this.sendApprovalResponse(retry)
		} catch {
			this.output("[Defaulting to: no]")
			this.sendApprovalResponse(false)
		}
		// Note: Don't delete from pendingAsks - see handleFollowupQuestion comment
	}

	/**
	 * Handle task resume prompt
	 */
	private async handleResumeTask(ts: number, ask: string, text: string): Promise<void> {
		const isCompleted = ask === "resume_completed_task"
		this.output(`\n[Resume ${isCompleted ? "Completed " : ""}Task]`)
		if (text) this.output(`  ${text}`)

		try {
			const resume = await this.promptForYesNo("Continue with this task? (y/n): ")
			this.sendApprovalResponse(resume)
		} catch {
			this.output("[Defaulting to: no]")
			this.sendApprovalResponse(false)
		}
		// Note: Don't delete from pendingAsks - see handleFollowupQuestion comment
	}

	/**
	 * Handle generic approval prompts for unknown ask types
	 */
	private async handleGenericApproval(ts: number, ask: string, text: string): Promise<void> {
		this.output(`\n[${ask}]`)
		if (text) this.output(`  ${text}`)

		try {
			const approved = await this.promptForYesNo("Approve? (y/n): ")
			this.sendApprovalResponse(approved)
		} catch {
			this.output("[Defaulting to: no]")
			this.sendApprovalResponse(false)
		}
		// Note: Don't delete from pendingAsks - see handleFollowupQuestion comment
	}

	/**
	 * Handle command_output ask messages - stream the output in real-time
	 * This is called for both partial (streaming) and complete messages
	 */
	private handleCommandOutputAsk(ts: number, text: string, isPartial: boolean | undefined): void {
		const previousDisplay = this.displayedMessages.get(ts)
		const alreadyDisplayedComplete = previousDisplay && !previousDisplay.partial

		// Stream partial content
		if (isPartial && text) {
			this.streamContent(ts, text, "[command output]")
			this.displayedMessages.set(ts, { text, partial: true })
		} else if (!isPartial) {
			// Message complete - output any remaining content and send approval
			if (text && !alreadyDisplayedComplete) {
				const streamed = this.streamedContent.get(ts)
				if (streamed) {
					// We were streaming - output any remaining delta and finish.
					if (text.length > streamed.text.length && text.startsWith(streamed.text)) {
						const delta = text.slice(streamed.text.length)
						this.writeStream(delta)
					}
					this.finishStream(ts)
				} else {
					this.writeStream("\n[command output] ")
					this.writeStream(text)
					this.writeStream("\n")
				}
				this.displayedMessages.set(ts, { text, partial: false })
				this.streamedContent.set(ts, { text, headerShown: true })
			}

			// Send approval response (only once per ts).
			if (!this.pendingAsks.has(ts)) {
				this.pendingAsks.add(ts)
				this.sendApprovalResponse(true)
			}
		}
	}

	/**
	 * Prompt user for text input via readline
	 */
	private promptForInput(prompt: string): Promise<string> {
		return new Promise((resolve, reject) => {
			// Temporarily restore console for interactive prompts
			const wasQuiet = this.options.quiet
			if (wasQuiet) {
				this.restoreConsole()
			}

			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			})

			rl.question(prompt, (answer) => {
				rl.close()

				// Restore quiet mode if it was enabled
				if (wasQuiet) {
					this.setupQuietMode()
				}

				resolve(answer)
			})

			// Handle stdin close (e.g., piped input ended)
			rl.on("close", () => {
				if (wasQuiet) {
					this.setupQuietMode()
				}
			})

			// Handle errors
			rl.on("error", (err) => {
				rl.close()
				if (wasQuiet) {
					this.setupQuietMode()
				}
				reject(err)
			})
		})
	}

	/**
	 * Prompt user for yes/no input
	 */
	private async promptForYesNo(prompt: string): Promise<boolean> {
		const answer = await this.promptForInput(prompt)
		const normalized = answer.trim().toLowerCase()
		// Accept y, yes, Y, Yes, YES, etc.
		return normalized === "y" || normalized === "yes"
	}

	/**
	 * Send a followup response (text answer) to the extension
	 */
	private sendFollowupResponse(text: string): void {
		this.sendToExtension({
			type: "askResponse",
			askResponse: "messageResponse",
			text,
		})
	}

	/**
	 * Send an approval response (yes/no) to the extension
	 */
	private sendApprovalResponse(approved: boolean): void {
		this.sendToExtension({
			type: "askResponse",
			askResponse: approved ? "yesButtonClicked" : "noButtonClicked",
		})
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

		// Clear pending asks
		this.pendingAsks.clear()

		// Close readline interface if open
		if (this.rl) {
			this.rl.close()
			this.rl = null
		}

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
