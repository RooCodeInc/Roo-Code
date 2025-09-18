import { Anthropic } from "@anthropic-ai/sdk"

import {
	type ModelInfo,
	type OpenAiNativeModelId,
	type ReasoningEffortWithMinimal,
	codexModels,
	codexDefaultModelId,
	normalizeCodexModelId,
	getCodexPreset,
	openAiNativeDefaultModelId,
	openAiNativeModels,
} from "@roo-code/types"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import YAML from "yaml"

import type { ApiHandlerOptions } from "../../shared/api"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import { CodexCliSession } from "../../integrations/codex/run"
import { getModelParams } from "../transform/model-params"
import { ApiStream, type ApiStreamChunk } from "../transform/stream"
import { OpenAiNativeHandler } from "./openai-native"

// Keep last 12 messages for context - balances between providing sufficient
// conversation history and avoiding token limit issues
const HISTORY_CONTEXT_WINDOW = 12
const HISTORY_REPLAY_LABEL = "Conversation so far:\n"

interface CodexSessionState {
	client: CodexCliSession
	processedMessages: number
	systemPromptInjected: boolean
}

/**
 * Codex provider backed by the local Codex CLI.
 *
 * The handler attempts to keep a persistent `codex proto` session per task so the
 * agent retains conversational state and can execute tool calls incrementally. If the
 * CLI is unavailable or fails mid-turn, we fall back to the OpenAI Responses API
 * implementation inherited from `OpenAiNativeHandler`.
 */
export class CodexHandler extends OpenAiNativeHandler {
	private readonly sessions = new Map<string, CodexSessionState>()

	constructor(options: ApiHandlerOptions) {
		const hydrated = CodexHandler.hydrateOpenAiAuth(options)
		super(hydrated)

		process.once("exit", () => {
			void this.disposeAllSessions()
process.once("exit", () => {
    this.disposeAllSessions().catch(error => 
        console.error("Failed to dispose Codex sessions on exit:", error)
    )
})
	}

	private static hydrateOpenAiAuth(options: ApiHandlerOptions): ApiHandlerOptions {
		if (options.openAiNativeApiKey && options.openAiNativeApiKey.trim()) {
			return options
		}

		const envKey = process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENAI_API_TOKEN
		if (envKey && envKey.trim()) {
			return { ...options, openAiNativeApiKey: envKey.trim() }
		}

		const customPath = (options as any).codexCliConfigPath as string | undefined
		const keyFromCustom = customPath ? this.readKeyFromConfigFile(customPath) : undefined
		if (keyFromCustom) {
			return { ...options, openAiNativeApiKey: keyFromCustom }
		}

		const candidates = [
			path.join(os.homedir(), ".config", "codex", "config.yaml"),
			path.join(os.homedir(), ".codex_api_key"),
			path.join(os.homedir(), ".config", "codex", "key"),
			path.join(os.homedir(), ".codex", "key"),
			path.join(os.homedir(), ".config", "openai", "config.yaml"),
			path.join(os.homedir(), ".openai_api_key"),
			path.join(os.homedir(), ".config", "openai", "key"),
			path.join(os.homedir(), ".openai", "key"),
		]

		for (const file of candidates) {
			const key = this.readKeyFromConfigFile(file)
			if (key) {
				return { ...options, openAiNativeApiKey: key }
			}
		}

		return options
	}

	private static readKeyFromConfigFile(filePath: string): string | undefined {
		try {
			const absolutePath = filePath.startsWith("~")
				? path.join(os.homedir(), filePath.slice(1))
				: path.resolve(filePath)
			if (!fs.existsSync(absolutePath)) return undefined

			const raw = fs.readFileSync(absolutePath, "utf8").trim()
			if (!raw) return undefined

			if (!raw.includes(":") && !raw.startsWith("{") && !raw.startsWith("[")) {
				return raw.split(/\r?\n/)[0]?.trim()
			}

			try {
				const doc = YAML.parse(raw)
				const keyLike = doc?.api_key || doc?.apiKey || doc?.OPENAI_API_KEY || doc?.token || doc?.access_token
				if (typeof keyLike === "string" && keyLike.trim()) return keyLike.trim()
			} catch {}

			try {
				const parsed = JSON.parse(raw)
				const keyLike =
					parsed?.api_key || parsed?.apiKey || parsed?.OPENAI_API_KEY || parsed?.token || parsed?.access_token
				if (typeof keyLike === "string" && keyLike.trim()) return keyLike.trim()
			} catch {}
		} catch {
			return undefined
		}

		return undefined
	}

	override getModel() {
		const codexIdRaw = (this.options.apiModelId as string) || codexDefaultModelId
		const codexId = normalizeCodexModelId(codexIdRaw)
		const openAiId = this.mapCodexIdToOpenAiModelId(codexId)
		const info: ModelInfo =
			this.options.openAiCustomModelInfo ||
			codexModels[codexId] ||
			openAiNativeModels[openAiId] ||
			codexModels[codexDefaultModelId]
		const params = getModelParams({ format: "openai", modelId: openAiId, model: info, settings: this.options })
		return { id: openAiId, info, ...params }
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const sessionKey = metadata?.taskId ?? "default"
		const codexModelIdRaw = (this.options.apiModelId as string) || codexDefaultModelId
		const codexModelId = normalizeCodexModelId(codexModelIdRaw)
		const model = this.getModel()
		const presetEffort = this.resolveReasoningEffort(codexModelId)
		const modelSlug = this.resolveModelForCli(codexModelId)

		const latestUserEntry = [...messages.entries()].reverse().find(([, message]) => message.role === "user")
		if (!latestUserEntry) {
			return
		}
		const [latestUserIndex, latestUserMessage] = latestUserEntry

		let session = this.sessions.get(sessionKey)
		let previousProcessed = session?.processedMessages ?? 0
		let sessionFresh = false

		if (latestUserIndex < previousProcessed) {
			return
		}

		const priorAssistantEntry = [...messages.entries()]
			.slice(0, latestUserIndex)
			.reverse()
			.find(([, message]) => message.role === "assistant")

		if (
			session &&
			priorAssistantEntry &&
			priorAssistantEntry[0] >= previousProcessed - 1 &&
			/task completed/i.test(this.extractMessageText(priorAssistantEntry[1]))
		) {
			await this.teardownSession(sessionKey)
			session = undefined
			previousProcessed = 0
		}

		if (!session) {
			sessionFresh = true
			try {
				const client = await CodexCliSession.create({
					cliPath: (this.options as any).codexCliPath,
					args: (this.options as any).codexCliArgs,
					debugEnabled: Boolean((this.options as any).codexDebugEnabled),
					debugLogPath: (this.options as any).codexDebugLogPath,
					allowNetworkAccess: true,
				})
				session = { client, processedMessages: 0, systemPromptInjected: false }
				this.sessions.set(sessionKey, session)
				previousProcessed = 0
			} catch (error) {
				console.debug("Codex CLI unavailable, falling back to OpenAI API", error)
				yield* super.createMessage(systemPrompt, messages, metadata)
				return
			}
		}

		const newMessages = messages.slice(previousProcessed)
		session.processedMessages = messages.length

		let prompt = this.extractMessageText(latestUserMessage)
		if (!prompt.trim()) {
			return
		}

		const timeoutArg =
			previousProcessed === 0 ? (process.env.CODEX_RTC_TIMEOUT ?? process.env.ROO_CODEX_RTC_TIMEOUT) : undefined
		const rtcHeader = timeoutArg ? `RTC Timeout: ${timeoutArg}ms\n` : ""
		const historySlice = messages
			.slice(Math.max(0, latestUserIndex - HISTORY_CONTEXT_WINDOW), latestUserIndex)
			.filter((message) => message.role !== "assistant")
		const history = !sessionFresh ? this.formatConversationHistory(historySlice) : ""

		if (sessionFresh) {
			const historyContext = this.formatConversationHistory(historySlice)
			const historyBlock = historyContext
				? `Context from earlier user instructions (for reference, avoid repeating completed work):\n${historyContext}\n\n`
				: ""
			prompt = `${rtcHeader}${historyBlock}New follow-up request (address only this; do not restate prior completion summaries):\n${prompt}`
		} else if (history) {
			prompt = `${rtcHeader}${HISTORY_REPLAY_LABEL}${history}\n\nLatest user request:\n${prompt}`
		} else if (rtcHeader) {
			prompt = `${rtcHeader}${prompt}`
		}

		if (!session.systemPromptInjected && systemPrompt) {
			prompt = `${systemPrompt.trim()}\n\n${prompt}`
			session.systemPromptInjected = true
		}

		try {
			const stream = await session.client.runTurn({
				text: prompt,
				model: modelSlug,
				approvalPolicy: "never",
				allowNetwork: true,
				effort: presetEffort,
			})

			const previousAssistantText = priorAssistantEntry ? this.extractMessageText(priorAssistantEntry[1]) : ""
			const hasPreviousAssistant = Boolean(previousAssistantText)
			let previousCursor = 0
			let emittedMeaningfulText = false
			let holdingChunks = hasPreviousAssistant
			const pendingChunks: ApiStreamChunk[] = []

			for await (const chunk of stream) {
				if (chunk.type === "text") {
					let text = chunk.text
					if (hasPreviousAssistant && previousCursor < previousAssistantText.length && text) {
						const expected = previousAssistantText.slice(previousCursor, previousCursor + text.length)
						const overlap = this.sharedPrefixLength(text, expected)
						previousCursor += overlap
						if (overlap >= text.length) {
							text = ""
						} else if (overlap > 0) {
							text = text.slice(overlap)
						}
					}

					if (text) {
						const sanitizedChunk: ApiStreamChunk = { ...chunk, text }
						const trimmed = text.trim()
						if (holdingChunks && !trimmed) {
							pendingChunks.push(sanitizedChunk)
							continue
						}

						if (trimmed) {
							emittedMeaningfulText = true
						}

						if (holdingChunks) {
							holdingChunks = false
							pendingChunks.push(sanitizedChunk)
							for (const pending of pendingChunks.splice(0)) {
								yield pending
							}
						} else {
							yield sanitizedChunk
						}
					}
					continue
				}

				if (holdingChunks) {
					pendingChunks.push(chunk)
				} else {
					yield chunk
				}
			}

			if (holdingChunks || !emittedMeaningfulText) {
				await this.teardownSession(sessionKey)
				const sanitizedMessages = priorAssistantEntry
					? messages.filter((_, idx) => idx !== priorAssistantEntry[0])
					: messages
				if (priorAssistantEntry) {
					yield* this.createMessage(systemPrompt, sanitizedMessages, metadata)
				} else {
					yield* super.createMessage(systemPrompt, sanitizedMessages, metadata)
				}
				return
			}
		} catch (error) {
			console.debug("Codex CLI turn failed, falling back to OpenAI API", error)
			await this.teardownSession(sessionKey)
			yield* super.createMessage(systemPrompt, messages, metadata)
		}
	}

	private async teardownSession(sessionKey: string) {
		const session = this.sessions.get(sessionKey)
		if (!session) return
		this.sessions.delete(sessionKey)
		try {
			await session.client.shutdown()
		} catch (error) {
			console.warn("Failed to shut down Codex CLI session:", error)
		}
	}

	private async disposeAllSessions() {
		const shutdowns = Array.from(this.sessions.keys()).map((key) => this.teardownSession(key))
		await Promise.allSettled(shutdowns)
	}

	private extractMessageText(message: Anthropic.Messages.MessageParam): string {
		const content = message.content
		if (typeof content === "string") {
			return content
		}

		if (!Array.isArray(content)) {
			return ""
		}

		return content
			.map((part) => {
				if (typeof part === "string") return part
				if (part?.type === "text" && typeof part.text === "string") return part.text
				if (typeof part === "object" && "text" in part && typeof part.text === "string") {
					return part.text
				}
				return ""
			})
			.filter(Boolean)
			.join("\n")
	}

	private formatConversationHistory(messages: Anthropic.Messages.MessageParam[]): string {
		const parts = messages
			.map((message) => {
				const text = this.extractMessageText(message).trim()
				if (!text) {
					return ""
				}
				const role = (message.role ?? "user") as string
				const label = role === "assistant" ? "Assistant" : role === "system" ? "System" : "User"
				return `${label}: ${text}`
			})
			.filter(Boolean)
		if (!parts.length) {
			return ""
		}
		return parts.join("\n\n")
	}

	private resolveModelForCli(modelId: string): string {
		const preset = getCodexPreset(modelId)
		if (preset?.cliModel) {
			return preset.cliModel
		}
		const normalized = (modelId || "").trim()
		if (!normalized) {
			return codexDefaultModelId
		}
		if (normalized.startsWith("gpt-5-")) {
			return "gpt-5-codex"
		}
		return normalized
	}

	private resolveReasoningEffort(modelId: string): ReasoningEffortWithMinimal | undefined {
		return getCodexPreset(modelId)?.effort
	}

	private mapCodexIdToOpenAiModelId(modelId: string): OpenAiNativeModelId {
		const preset = getCodexPreset(modelId)
		if (preset?.cliModel && preset.cliModel in openAiNativeModels) {
			return preset.cliModel as OpenAiNativeModelId
		}
		const normalized = (modelId || "").trim()
		if (normalized in openAiNativeModels) {
			return normalized as OpenAiNativeModelId
		}
		return openAiNativeDefaultModelId
	}

	private sharedPrefixLength(a: string, b: string): number {
		const limit = Math.min(a.length, b.length)
		let index = 0
		while (index < limit && a.charCodeAt(index) === b.charCodeAt(index)) {
			index += 1
		}
		return index
	}
}
