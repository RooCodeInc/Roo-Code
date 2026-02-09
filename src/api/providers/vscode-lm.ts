import * as vscode from "vscode"
import { streamText, generateText } from "ai"
import type {
	LanguageModelV3,
	LanguageModelV3CallOptions,
	LanguageModelV3GenerateResult,
	LanguageModelV3StreamPart,
	LanguageModelV3StreamResult,
	LanguageModelV3Prompt,
	LanguageModelV3FunctionTool,
	LanguageModelV3ProviderTool,
	LanguageModelV3Usage,
	LanguageModelV3FinishReason,
} from "@ai-sdk/provider"

import { type ModelInfo, openAiModelInfoSaneDefaults } from "@roo-code/types"

import type { NeutralMessageParam, NeutralContentBlock } from "../../core/task-persistence"
import type { ApiHandlerOptions } from "../../shared/api"
import { SELECTOR_SEPARATOR, stringifyVsCodeLmModelSelector } from "../../shared/vsCodeSelectorUtils"
import { normalizeToolSchema } from "../../utils/json-schema"

import {
	convertToAiSdkMessages,
	convertToolsForAiSdk,
	processAiSdkStreamPart,
	mapToolChoice,
	handleAiSdkError,
} from "../transform/ai-sdk"
import { ApiStream } from "../transform/stream"

import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

// ────────────────────────────────────────────────────────────────────────────
// Utility: Convert LanguageModelV3Prompt → vscode.LanguageModelChatMessage[]
// ────────────────────────────────────────────────────────────────────────────

/**
 * Safely converts a value into a plain object.
 */
function asObjectSafe(value: unknown): object {
	if (!value) {
		return {}
	}
	try {
		if (typeof value === "string") {
			return JSON.parse(value)
		}
		if (typeof value === "object") {
			return { ...value }
		}
		return {}
	} catch {
		return {}
	}
}

/**
 * Converts an AI SDK LanguageModelV3Prompt to VS Code LM messages.
 * This bridges the AI SDK's standard prompt format to the VS Code Language Model API.
 */
function convertV3PromptToVsCodeLm(prompt: LanguageModelV3Prompt): vscode.LanguageModelChatMessage[] {
	const messages: vscode.LanguageModelChatMessage[] = []

	for (const message of prompt) {
		switch (message.role) {
			case "system":
				// VS Code LM has no system role — prepend as assistant message (matching existing behavior)
				messages.push(vscode.LanguageModelChatMessage.Assistant(message.content))
				break

			case "user": {
				const parts: (vscode.LanguageModelTextPart | vscode.LanguageModelToolResultPart)[] = []
				for (const part of message.content) {
					if (part.type === "text") {
						parts.push(new vscode.LanguageModelTextPart(part.text))
					} else if (part.type === "file") {
						// VS Code LM doesn't support files/images — emit placeholder
						parts.push(
							new vscode.LanguageModelTextPart(
								`[File: ${part.mediaType} not supported by VS Code LM API]`,
							),
						)
					}
				}
				if (parts.length > 0) {
					messages.push(vscode.LanguageModelChatMessage.User(parts))
				}
				break
			}

			case "assistant": {
				const parts: (vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart)[] = []
				for (const part of message.content) {
					if (part.type === "text") {
						parts.push(new vscode.LanguageModelTextPart(part.text))
					} else if (part.type === "tool-call") {
						parts.push(
							new vscode.LanguageModelToolCallPart(
								part.toolCallId,
								part.toolName,
								asObjectSafe(part.input),
							),
						)
					} else if (part.type === "file") {
						parts.push(
							new vscode.LanguageModelTextPart("[File generation not supported by VS Code LM API]"),
						)
					}
					// reasoning parts are not supported by VS Code LM — skip
				}
				if (parts.length > 0) {
					messages.push(vscode.LanguageModelChatMessage.Assistant(parts))
				}
				break
			}

			case "tool": {
				const parts: vscode.LanguageModelToolResultPart[] = []
				for (const part of message.content) {
					if (part.type === "tool-result") {
						let textContent: string
						if (part.output.type === "text") {
							textContent = part.output.value
						} else if (part.output.type === "json") {
							textContent = JSON.stringify(part.output.value)
						} else if (part.output.type === "execution-denied") {
							textContent = part.output.reason ?? "Tool execution denied"
						} else {
							// error-text or other types
							textContent = "value" in part.output ? String(part.output.value) : "(empty)"
						}
						parts.push(
							new vscode.LanguageModelToolResultPart(part.toolCallId, [
								new vscode.LanguageModelTextPart(textContent),
							]),
						)
					}
					// tool-approval-response parts are not supported — skip
				}
				if (parts.length > 0) {
					messages.push(vscode.LanguageModelChatMessage.User(parts))
				}
				break
			}
		}
	}

	return messages
}

// ────────────────────────────────────────────────────────────────────────────
// Utility: Convert LanguageModelV3 tools → vscode.LanguageModelChatTool[]
// ────────────────────────────────────────────────────────────────────────────

/**
 * Converts AI SDK tools to VS Code Language Model tools.
 * Normalizes the JSON Schema to draft 2020-12 compliant format required by
 * GitHub Copilot's backend.
 */
function convertV3ToolsToVsCodeLm(
	tools: Array<LanguageModelV3FunctionTool | LanguageModelV3ProviderTool> | undefined,
): vscode.LanguageModelChatTool[] {
	if (!tools) {
		return []
	}
	return tools
		.filter((t): t is LanguageModelV3FunctionTool => t.type === "function")
		.map((t) => ({
			name: t.name,
			description: t.description ?? "",
			inputSchema: normalizeToolSchema(t.inputSchema as Record<string, unknown>),
		}))
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: Build LanguageModelV3Usage with all-undefined fields
// ────────────────────────────────────────────────────────────────────────────

function makeEmptyUsage(): LanguageModelV3Usage {
	return {
		inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
		outputTokens: { total: undefined, text: undefined, reasoning: undefined },
	}
}

function makeFinishReason(hasToolCalls: boolean): LanguageModelV3FinishReason {
	return {
		unified: hasToolCalls ? "tool-calls" : "stop",
		raw: undefined,
	}
}

// ────────────────────────────────────────────────────────────────────────────
// Utility: Extract text from a VS Code LM message (for token counting)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the text content from a VS Code Language Model chat message.
 * @param message A VS Code Language Model chat message.
 * @returns The extracted text content.
 */
function extractTextCountFromMessage(message: vscode.LanguageModelChatMessage): string {
	let text = ""
	if (Array.isArray(message.content)) {
		for (const item of message.content) {
			if (item instanceof vscode.LanguageModelTextPart) {
				text += item.value
			}
			if (item instanceof vscode.LanguageModelToolResultPart) {
				text += item.callId
				for (const part of item.content) {
					if (part instanceof vscode.LanguageModelTextPart) {
						text += part.value
					}
				}
			}
			if (item instanceof vscode.LanguageModelToolCallPart) {
				text += item.name
				text += item.callId
				if (item.input && Object.keys(item.input).length > 0) {
					try {
						text += JSON.stringify(item.input)
					} catch (error) {
						console.error("Roo Code <Language Model API>: Failed to stringify tool call input:", error)
					}
				}
			}
		}
	} else if (typeof message.content === "string") {
		text += message.content
	}
	return text
}

// ────────────────────────────────────────────────────────────────────────────
// VsCodeLmLanguageModel — LanguageModelV3 adapter for vscode.LanguageModelChat
// ────────────────────────────────────────────────────────────────────────────

/**
 * A custom LanguageModelV3 adapter that wraps `vscode.LanguageModelChat`.
 * This allows using VS Code's native Language Model API through the AI SDK's
 * `streamText` / `generateText` functions.
 */
class VsCodeLmLanguageModel implements LanguageModelV3 {
	readonly specificationVersion = "v3" as const
	readonly provider = "vscode-lm"
	readonly modelId: string
	readonly supportedUrls: Record<string, RegExp[]> = {}

	private client: vscode.LanguageModelChat
	private cancellationTokenSource: vscode.CancellationTokenSource | undefined

	constructor(client: vscode.LanguageModelChat, cancellationTokenSource?: vscode.CancellationTokenSource) {
		this.client = client
		this.modelId = client.id ?? "unknown"
		this.cancellationTokenSource = cancellationTokenSource
	}

	async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
		const messages = convertV3PromptToVsCodeLm(options.prompt)
		const tools = convertV3ToolsToVsCodeLm(options.tools)
		const cancellationToken = this.cancellationTokenSource?.token ?? new vscode.CancellationTokenSource().token

		// Bridge abort signal to VS Code cancellation
		this.bridgeAbortSignal(options.abortSignal)

		const requestOptions: vscode.LanguageModelChatRequestOptions = {
			justification: `Roo Code would like to use '${this.client.name}' from '${this.client.vendor}', Click 'Allow' to proceed.`,
			tools: tools.length > 0 ? tools : undefined,
		}

		try {
			const response = await this.client.sendRequest(messages, requestOptions, cancellationToken)

			const content: LanguageModelV3GenerateResult["content"] = []
			let hasToolCalls = false

			for await (const chunk of response.stream) {
				if (chunk instanceof vscode.LanguageModelTextPart) {
					// Merge consecutive text parts
					const lastContent = content[content.length - 1]
					if (lastContent && lastContent.type === "text") {
						lastContent.text += chunk.value
					} else {
						content.push({ type: "text", text: chunk.value })
					}
				} else if (chunk instanceof vscode.LanguageModelToolCallPart) {
					hasToolCalls = true
					content.push({
						type: "tool-call",
						toolCallId: chunk.callId,
						toolName: chunk.name,
						input: JSON.stringify(chunk.input),
					})
				}
			}

			return {
				content,
				finishReason: makeFinishReason(hasToolCalls),
				usage: makeEmptyUsage(),
				warnings: [],
			}
		} catch (error) {
			if (error instanceof vscode.CancellationError) {
				throw new Error("Roo Code <Language Model API>: Request cancelled by user")
			}
			throw error
		}
	}

	async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
		const messages = convertV3PromptToVsCodeLm(options.prompt)
		const tools = convertV3ToolsToVsCodeLm(options.tools)
		const cancellationToken = this.cancellationTokenSource?.token ?? new vscode.CancellationTokenSource().token

		// Bridge abort signal to VS Code cancellation
		this.bridgeAbortSignal(options.abortSignal)

		const requestOptions: vscode.LanguageModelChatRequestOptions = {
			justification: `Roo Code would like to use '${this.client.name}' from '${this.client.vendor}', Click 'Allow' to proceed.`,
			tools: tools.length > 0 ? tools : undefined,
		}

		const response = await this.client.sendRequest(messages, requestOptions, cancellationToken)

		let hasToolCalls = false
		const textId = "text-0"

		const stream = new ReadableStream<LanguageModelV3StreamPart>({
			async start(controller) {
				controller.enqueue({ type: "stream-start", warnings: [] })

				let textStarted = false

				try {
					for await (const chunk of response.stream) {
						if (chunk instanceof vscode.LanguageModelTextPart) {
							if (typeof chunk.value !== "string") {
								continue
							}
							if (!textStarted) {
								controller.enqueue({ type: "text-start", id: textId })
								textStarted = true
							}
							controller.enqueue({ type: "text-delta", id: textId, delta: chunk.value })
						} else if (chunk instanceof vscode.LanguageModelToolCallPart) {
							if (!chunk.name || !chunk.callId) {
								continue
							}
							// Close any open text segment before tool calls
							if (textStarted) {
								controller.enqueue({ type: "text-end", id: textId })
								textStarted = false
							}
							hasToolCalls = true

							// Emit streaming tool call pattern
							const inputStr = JSON.stringify(chunk.input ?? {})
							controller.enqueue({
								type: "tool-input-start",
								id: chunk.callId,
								toolName: chunk.name,
							})
							controller.enqueue({
								type: "tool-input-delta",
								id: chunk.callId,
								delta: inputStr,
							})
							controller.enqueue({
								type: "tool-input-end",
								id: chunk.callId,
							})
						}
					}

					// Close any open text segment
					if (textStarted) {
						controller.enqueue({ type: "text-end", id: textId })
					}

					controller.enqueue({
						type: "finish",
						finishReason: makeFinishReason(hasToolCalls),
						usage: makeEmptyUsage(),
					})

					controller.close()
				} catch (error) {
					if (textStarted) {
						try {
							controller.enqueue({ type: "text-end", id: textId })
						} catch {
							// controller may be errored already
						}
					}

					if (error instanceof vscode.CancellationError) {
						controller.error(new Error("Roo Code <Language Model API>: Request cancelled by user"))
					} else {
						controller.error(error)
					}
				}
			},
		})

		return { stream }
	}

	/**
	 * Bridges an AbortSignal to the VS Code CancellationTokenSource.
	 */
	private bridgeAbortSignal(abortSignal: AbortSignal | undefined): void {
		if (abortSignal && this.cancellationTokenSource) {
			const cts = this.cancellationTokenSource
			abortSignal.addEventListener("abort", () => cts.cancel(), { once: true })
		}
	}
}

// ────────────────────────────────────────────────────────────────────────────
// VsCodeLmHandler — Provider handler using the AI SDK via the adapter
// ────────────────────────────────────────────────────────────────────────────

/**
 * Handles interaction with VS Code's Language Model API for chat-based operations.
 * Uses the AI SDK's `streamText` / `generateText` through a custom LanguageModelV3 adapter.
 *
 * @extends {BaseProvider}
 */
export class VsCodeLmHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: vscode.LanguageModelChat | null
	private disposable: vscode.Disposable | null
	private currentRequestCancellation: vscode.CancellationTokenSource | null

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.client = null
		this.disposable = null
		this.currentRequestCancellation = null

		try {
			// Listen for model changes and reset client
			this.disposable = vscode.workspace.onDidChangeConfiguration((event) => {
				if (event.affectsConfiguration("lm")) {
					try {
						this.client = null
						this.ensureCleanState()
					} catch (error) {
						console.error("Error during configuration change cleanup:", error)
					}
				}
			})
			this.initializeClient()
		} catch (error) {
			// Ensure cleanup if constructor fails
			this.dispose()
			throw new Error(
				`Roo Code <Language Model API>: Failed to initialize handler: ${error instanceof Error ? error.message : "Unknown error"}`,
			)
		}
	}

	/**
	 * Initializes the VS Code Language Model client.
	 */
	async initializeClient(): Promise<void> {
		try {
			if (this.client) {
				return
			}
			this.client = await this.createClient(this.options.vsCodeLmModelSelector || {})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error"
			throw new Error(`Roo Code <Language Model API>: Failed to initialize client: ${errorMessage}`)
		}
	}

	/**
	 * Creates a language model chat client based on the provided selector.
	 */
	async createClient(selector: vscode.LanguageModelChatSelector): Promise<vscode.LanguageModelChat> {
		try {
			const models = await vscode.lm.selectChatModels(selector)

			if (models && Array.isArray(models) && models.length > 0) {
				return models[0]
			}

			// Create a minimal model if no models are available
			return {
				id: "default-lm",
				name: "Default Language Model",
				vendor: "vscode",
				family: "lm",
				version: "1.0",
				maxInputTokens: 8192,
				sendRequest: async (_messages, _options, _token) => {
					return {
						stream: (async function* () {
							yield new vscode.LanguageModelTextPart(
								"Language model functionality is limited. Please check VS Code configuration.",
							)
						})(),
						text: (async function* () {
							yield "Language model functionality is limited. Please check VS Code configuration."
						})(),
					}
				},
				countTokens: async () => 0,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error"
			throw new Error(`Roo Code <Language Model API>: Failed to select model: ${errorMessage}`)
		}
	}

	override isAiSdkProvider(): boolean {
		return true
	}

	dispose(): void {
		if (this.disposable) {
			this.disposable.dispose()
		}
		if (this.currentRequestCancellation) {
			this.currentRequestCancellation.cancel()
			this.currentRequestCancellation.dispose()
		}
	}

	/**
	 * Implements the ApiHandler countTokens interface method.
	 * Uses VS Code's native token counting API.
	 */
	override async countTokens(content: NeutralContentBlock[]): Promise<number> {
		let textContent = ""
		for (const block of content) {
			if (block.type === "text") {
				textContent += block.text || ""
			} else if (block.type === "image") {
				textContent += "[IMAGE]"
			}
		}
		return this.internalCountTokens(textContent)
	}

	/**
	 * Private implementation of token counting used internally.
	 */
	private async internalCountTokens(text: string | vscode.LanguageModelChatMessage): Promise<number> {
		if (!this.client) {
			return 0
		}
		if (!text) {
			return 0
		}

		let cancellationToken: vscode.CancellationToken
		let tempCancellation: vscode.CancellationTokenSource | null = null

		if (this.currentRequestCancellation) {
			cancellationToken = this.currentRequestCancellation.token
		} else {
			tempCancellation = new vscode.CancellationTokenSource()
			cancellationToken = tempCancellation.token
		}

		try {
			let tokenCount: number

			if (typeof text === "string") {
				tokenCount = await this.client.countTokens(text, cancellationToken)
			} else if (text instanceof vscode.LanguageModelChatMessage) {
				if (!text.content || (Array.isArray(text.content) && text.content.length === 0)) {
					return 0
				}
				const countMessage = extractTextCountFromMessage(text)
				tokenCount = await this.client.countTokens(countMessage, cancellationToken)
			} else {
				return 0
			}

			if (typeof tokenCount !== "number" || tokenCount < 0) {
				return 0
			}

			return tokenCount
		} catch (error) {
			if (error instanceof vscode.CancellationError) {
				return 0
			}
			return 0
		} finally {
			if (tempCancellation) {
				tempCancellation.dispose()
			}
		}
	}

	private ensureCleanState(): void {
		if (this.currentRequestCancellation) {
			this.currentRequestCancellation.cancel()
			this.currentRequestCancellation.dispose()
			this.currentRequestCancellation = null
		}
	}

	private async getClient(): Promise<vscode.LanguageModelChat> {
		if (!this.client) {
			const selector = this.options?.vsCodeLmModelSelector || {}
			this.client = await this.createClient(selector)
		}
		return this.client
	}

	/**
	 * Creates and streams a message using the AI SDK with the VS Code LM adapter.
	 */
	override async *createMessage(
		systemPrompt: string,
		messages: NeutralMessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		this.ensureCleanState()
		const client = await this.getClient()

		// Set up cancellation
		this.currentRequestCancellation = new vscode.CancellationTokenSource()

		// Create the adapter wrapping the VS Code LM client
		const model = new VsCodeLmLanguageModel(client, this.currentRequestCancellation)

		// Convert messages and tools via the AI SDK transform utilities
		const aiSdkMessages = convertToAiSdkMessages(messages)
		const openAiTools = this.convertToolsForOpenAI(metadata?.tools)
		const aiSdkTools = convertToolsForAiSdk(openAiTools)

		const result = streamText({
			model,
			system: systemPrompt,
			messages: aiSdkMessages,
			tools: aiSdkTools ?? undefined,
			toolChoice: mapToolChoice(metadata?.tool_choice),
		})

		try {
			for await (const part of result.fullStream) {
				for (const chunk of processAiSdkStreamPart(part)) {
					yield chunk
				}
			}

			const usage = await result.usage
			if (usage) {
				yield {
					type: "usage" as const,
					inputTokens: usage.inputTokens ?? 0,
					outputTokens: usage.outputTokens ?? 0,
				}
			}
		} catch (error) {
			this.ensureCleanState()
			throw handleAiSdkError(error, "VS Code LM")
		}
	}

	override getModel(): { id: string; info: ModelInfo } {
		if (this.client) {
			const modelParts = [this.client.vendor, this.client.family, this.client.version].filter(Boolean)
			const modelId = this.client.id || modelParts.join(SELECTOR_SEPARATOR)

			const modelInfo: ModelInfo = {
				maxTokens: -1,
				contextWindow:
					typeof this.client.maxInputTokens === "number"
						? Math.max(0, this.client.maxInputTokens)
						: openAiModelInfoSaneDefaults.contextWindow,
				supportsImages: false,
				supportsPromptCache: true,
				inputPrice: 0,
				outputPrice: 0,
				description: `VSCode Language Model: ${modelId}`,
			}

			return { id: modelId, info: modelInfo }
		}

		const fallbackId = this.options.vsCodeLmModelSelector
			? stringifyVsCodeLmModelSelector(this.options.vsCodeLmModelSelector)
			: "vscode-lm"

		return {
			id: fallbackId,
			info: {
				...openAiModelInfoSaneDefaults,
				description: `VSCode Language Model (Fallback): ${fallbackId}`,
			},
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const client = await this.getClient()

		// Set up cancellation
		const cancellation = new vscode.CancellationTokenSource()
		const model = new VsCodeLmLanguageModel(client, cancellation)

		try {
			const { text } = await generateText({
				model,
				prompt,
			})
			return text
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`VSCode LM completion error: ${error.message}`)
			}
			throw error
		} finally {
			cancellation.dispose()
		}
	}
}

// ────────────────────────────────────────────────────────────────────────────
// Exported utility: list available VS Code LM models
// ────────────────────────────────────────────────────────────────────────────

// Static blacklist of VS Code Language Model IDs that should be excluded
const VSCODE_LM_STATIC_BLACKLIST: string[] = ["claude-3.7-sonnet", "claude-3.7-sonnet-thought"]

export async function getVsCodeLmModels() {
	try {
		const models = (await vscode.lm.selectChatModels({})) || []
		return models.filter((model) => !VSCODE_LM_STATIC_BLACKLIST.includes(model.id))
	} catch (error) {
		console.error(
			`Error fetching VS Code LM models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
		return []
	}
}
