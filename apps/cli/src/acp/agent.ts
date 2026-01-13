/**
 * RooCodeAgent
 *
 * Implements the ACP Agent interface to expose Roo Code as an ACP-compatible agent.
 * This allows ACP clients like Zed to use Roo Code as their AI coding assistant.
 */

import {
	type Agent,
	type ClientCapabilities,
	type CancelNotification,
	// Requests + Responses
	type InitializeRequest,
	type InitializeResponse,
	type NewSessionRequest,
	type NewSessionResponse,
	type SetSessionModeRequest,
	type SetSessionModeResponse,
	type SetSessionModelRequest,
	type SetSessionModelResponse,
	type AuthenticateRequest,
	type AuthenticateResponse,
	type PromptRequest,
	type PromptResponse,
	// Classes
	AgentSideConnection,
	RequestError,
	// Constants
	PROTOCOL_VERSION,
} from "@agentclientprotocol/sdk"
import { randomUUID } from "node:crypto"

import { DEFAULT_FLAGS } from "@/types/constants.js"
import { envVarMap } from "@/lib/utils/provider.js"
import { login, status } from "@/commands/auth/index.js"

import { AVAILABLE_MODES, DEFAULT_MODELS } from "./types.js"
import { type AcpSessionOptions, AcpSession } from "./session.js"
import { acpLog } from "./logger.js"
import { ModelService, createModelService } from "./model-service.js"

/**
 * RooCodeAgent implements the ACP Agent interface.
 *
 * It manages multiple sessions, each with its own ExtensionHost instance,
 * and handles protocol-level operations like initialization and authentication.
 */
export class RooCodeAgent implements Agent {
	private sessions: Map<string, AcpSession> = new Map()
	private clientCapabilities: ClientCapabilities | undefined
	private isAuthenticated = false
	private readonly modelService: ModelService

	constructor(
		private readonly options: AcpSessionOptions,
		private readonly connection: AgentSideConnection,
	) {
		acpLog.info("Agent", `RooCodeAgent constructor: connection=${connection}`)
		this.modelService = createModelService({ apiKey: options.apiKey })
	}

	async initialize(params: InitializeRequest): Promise<InitializeResponse> {
		acpLog.request("initialize", params)
		this.clientCapabilities = params.clientCapabilities

		// Check if already authenticated via environment or existing credentials.
		const { authenticated } = await status({ verbose: false })
		acpLog.debug("Agent", `Auth status: ${authenticated ? "authenticated" : "not authenticated"}`)

		return {
			protocolVersion: PROTOCOL_VERSION,
			authMethods: [
				{
					id: "roo",
					name: "Sign in with Roo Code Cloud",
					description: `Sign in with your Roo Code Cloud account or BYOK by exporting an API key Environment Variable (${Object.values(envVarMap).join(", ")})`,
				},
			],
			agentCapabilities: {
				loadSession: false,
				promptCapabilities: {
					image: true,
					embeddedContext: true,
				},
			},
		}
	}

	async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
		acpLog.request("newSession", params)

		// @TODO: Detect other env vars for different provider and choose
		// the correct provider or throw.
		if (!this.isAuthenticated) {
			const apiKey = this.options.apiKey || process.env.OPENROUTER_API_KEY

			if (!apiKey) {
				acpLog.error("Agent", "newSession failed: not authenticated and no API key")
				throw RequestError.authRequired()
			}

			this.isAuthenticated = true
		}

		const sessionId = randomUUID()
		const provider = this.options.provider || "openrouter"
		const apiKey = this.options.apiKey || process.env.OPENROUTER_API_KEY
		const mode = this.options.mode || AVAILABLE_MODES[0]!.id
		const model = this.options.model || DEFAULT_FLAGS.model

		const session = await AcpSession.create({
			sessionId,
			cwd: params.cwd,
			connection: this.connection,
			options: {
				extensionPath: this.options.extensionPath,
				provider,
				apiKey,
				model,
				mode,
			},
			deps: {
				logger: acpLog,
			},
		})

		this.sessions.set(sessionId, session)

		const availableModels = await this.modelService.fetchAvailableModels()
		const modelExists = availableModels.some((m) => m.modelId === model)

		const response: NewSessionResponse = {
			sessionId,
			modes: { currentModeId: mode, availableModes: AVAILABLE_MODES },
			models: {
				availableModels,
				currentModelId: modelExists ? model : DEFAULT_MODELS[0]!.modelId,
			},
		}

		acpLog.response("newSession", response)
		return response
	}

	async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse | void> {
		acpLog.request("setSessionMode", params)
		const session = this.sessions.get(params.sessionId)

		if (!session) {
			acpLog.error("Agent", `setSessionMode failed: session not found: ${params.sessionId}`)
			throw RequestError.invalidParams(undefined, `Session not found: ${params.sessionId}`)
		}

		const mode = AVAILABLE_MODES.find((m) => m.id === params.modeId)

		if (!mode) {
			acpLog.error("Agent", `setSessionMode failed: unknown mode: ${params.modeId}`)
			throw RequestError.invalidParams(undefined, `Unknown mode: ${params.modeId}`)
		}

		session.setMode(params.modeId)
		acpLog.response("setSessionMode", {})
		return {}
	}

	async unstable_setSessionModel?(params: SetSessionModelRequest): Promise<SetSessionModelResponse | void> {
		acpLog.request("setSessionMode", params)
		const session = this.sessions.get(params.sessionId)

		if (!session) {
			acpLog.error("Agent", `unstable_setSessionModel failed: session not found: ${params.sessionId}`)
			throw RequestError.invalidParams(undefined, `Session not found: ${params.sessionId}`)
		}

		const availableModels = await this.modelService.fetchAvailableModels()
		const modelExists = availableModels.some((m) => m.modelId === params.modelId)

		if (!modelExists) {
			acpLog.error("Agent", `unstable_setSessionModel failed: model not found: ${params.modelId}`)
			throw RequestError.invalidParams(undefined, `Model not found: ${params.modelId}`)
		}

		session.setModel(params.modelId)
		acpLog.response("unstable_setSessionModel", {})
		return {}
	}

	async authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse | void> {
		acpLog.request("authenticate", params)

		if (params.methodId !== "roo") {
			throw RequestError.invalidParams(undefined, `Invalid auth method: ${params.methodId}`)
		}

		const result = await login({ verbose: false })

		if (!result.success) {
			throw RequestError.authRequired(undefined, "Failed to authenticate with Roo Code Cloud")
		}

		this.isAuthenticated = true

		acpLog.response("authenticate", {})
		return {}
	}

	async prompt(params: PromptRequest): Promise<PromptResponse> {
		acpLog.request("prompt", {
			sessionId: params.sessionId,
			promptLength: params.prompt?.length ?? 0,
		})

		const session = this.sessions.get(params.sessionId)
		if (!session) {
			acpLog.error("Agent", `prompt failed: session not found: ${params.sessionId}`)
			throw RequestError.invalidParams(undefined, `Session not found: ${params.sessionId}`)
		}

		const response = await session.prompt(params)
		acpLog.response("prompt", response)
		return response
	}

	async cancel(params: CancelNotification): Promise<void> {
		acpLog.request("cancel", { sessionId: params.sessionId })

		const session = this.sessions.get(params.sessionId)
		if (session) {
			session.cancel()
			acpLog.info("Agent", `Cancelled session: ${params.sessionId}`)
		} else {
			acpLog.warn("Agent", `cancel: session not found: ${params.sessionId}`)
		}
	}

	async dispose(): Promise<void> {
		acpLog.info("Agent", `Disposing ${this.sessions.size} sessions`)
		const disposals = Array.from(this.sessions.values()).map((session) => session.dispose())
		await Promise.all(disposals)
		this.sessions.clear()
		acpLog.info("Agent", "All sessions disposed")
	}
}
