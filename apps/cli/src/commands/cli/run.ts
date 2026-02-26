import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import { createElement } from "react"
import type { HistoryItem } from "@roo-code/types"

import { setLogger } from "@roo-code/vscode-shim"

import {
	FlagOptions,
	isSupportedProvider,
	OnboardingProviderChoice,
	supportedProviders,
	DEFAULT_FLAGS,
	REASONING_EFFORTS,
	SDK_BASE_URL,
	OutputFormat,
} from "@/types/index.js"
import { isValidOutputFormat } from "@/types/json-events.js"
import { JsonEventEmitter } from "@/agent/json-event-emitter.js"

import { createClient } from "@/lib/sdk/index.js"
import { loadToken, loadSettings } from "@/lib/storage/index.js"
import { isRecord } from "@/lib/utils/guards.js"
import { arePathsEqual } from "@/lib/utils/path.js"
import { getEnvVarName, getApiKeyFromEnv } from "@/lib/utils/provider.js"
import { runOnboarding } from "@/lib/utils/onboarding.js"
import { getDefaultExtensionPath } from "@/lib/utils/extension.js"
import { VERSION } from "@/lib/utils/version.js"

import { ExtensionHost, ExtensionHostOptions } from "@/agent/index.js"
import { runStdinStreamMode } from "./stdin-stream.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROO_MODEL_WARMUP_TIMEOUT_MS = 10_000
const SIGNAL_ONLY_EXIT_KEEPALIVE_MS = 60_000

function normalizeError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error))
}

async function warmRooModels(host: ExtensionHost): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		let settled = false

		const cleanup = () => {
			clearTimeout(timeoutId)
			host.off("extensionWebviewMessage", onMessage)
		}

		const finish = (fn: () => void) => {
			if (settled) return
			settled = true
			cleanup()
			fn()
		}

		const onMessage = (message: unknown) => {
			if (!isRecord(message)) {
				return
			}

			if (message.type !== "singleRouterModelFetchResponse") {
				return
			}

			const values = isRecord(message.values) ? message.values : undefined

			if (values?.provider !== "roo") {
				return
			}

			if (message.success === false) {
				const errorMessage =
					typeof message.error === "string" && message.error.length > 0
						? message.error
						: "failed to refresh Roo models"

				finish(() => reject(new Error(errorMessage)))
				return
			}

			finish(() => resolve())
		}

		const timeoutId = setTimeout(() => {
			finish(() => reject(new Error(`timed out waiting for Roo models after ${ROO_MODEL_WARMUP_TIMEOUT_MS}ms`)))
		}, ROO_MODEL_WARMUP_TIMEOUT_MS)

		host.on("extensionWebviewMessage", onMessage)
		host.sendToExtension({ type: "requestRooModels" })
	})
}

function extractTaskHistoryFromMessage(message: unknown): HistoryItem[] | undefined {
	if (!isRecord(message)) {
		return undefined
	}

	if (message.type === "state") {
		const state = isRecord(message.state) ? message.state : undefined
		if (Array.isArray(state?.taskHistory)) {
			return state.taskHistory as HistoryItem[]
		}
	}

	if (message.type === "taskHistoryUpdated" && Array.isArray(message.taskHistory)) {
		return message.taskHistory as HistoryItem[]
	}

	return undefined
}

function getMostRecentTaskIdInWorkspace(taskHistory: HistoryItem[], workspacePath: string): string | undefined {
	const workspaceTasks = taskHistory.filter(
		(item) => typeof item.workspace === "string" && arePathsEqual(item.workspace, workspacePath),
	)

	if (workspaceTasks.length === 0) {
		return undefined
	}

	const sorted = [...workspaceTasks].sort((a, b) => b.ts - a.ts)
	return sorted[0]?.id
}

export async function run(promptArg: string | undefined, flagOptions: FlagOptions) {
	setLogger({
		info: () => {},
		warn: () => {},
		error: () => {},
		debug: () => {},
	})

	let prompt = promptArg

	if (flagOptions.promptFile) {
		if (!fs.existsSync(flagOptions.promptFile)) {
			console.error(`[CLI] Error: Prompt file does not exist: ${flagOptions.promptFile}`)
			process.exit(1)
		}

		prompt = fs.readFileSync(flagOptions.promptFile, "utf-8")
	}

	const requestedSessionId = flagOptions.sessionId?.trim()
	const shouldContinueSession = flagOptions.continue
	const isResumeRequested = Boolean(requestedSessionId || shouldContinueSession)

	if (flagOptions.sessionId !== undefined && !requestedSessionId) {
		console.error("[CLI] Error: --session-id requires a non-empty task id")
		process.exit(1)
	}

	if (requestedSessionId && shouldContinueSession) {
		console.error("[CLI] Error: cannot use --session-id with --continue")
		process.exit(1)
	}

	if (isResumeRequested && prompt) {
		console.error("[CLI] Error: cannot use prompt or --prompt-file with --session-id/--continue")
		console.error("[CLI] Usage: roo [--session-id <task-id> | --continue] [options]")
		process.exit(1)
	}

	// Options

	let rooToken = await loadToken()
	const settings = await loadSettings()

	const isTuiSupported = process.stdin.isTTY && process.stdout.isTTY
	const isTuiEnabled = !flagOptions.print && isTuiSupported
	const isOnboardingEnabled = isTuiEnabled && !rooToken && !flagOptions.provider && !settings.provider

	// Determine effective values: CLI flags > settings file > DEFAULT_FLAGS.
	const effectiveMode = flagOptions.mode || settings.mode || DEFAULT_FLAGS.mode
	const effectiveModel = flagOptions.model || settings.model || DEFAULT_FLAGS.model
	const effectiveReasoningEffort =
		flagOptions.reasoningEffort || settings.reasoningEffort || DEFAULT_FLAGS.reasoningEffort
	const effectiveProvider = flagOptions.provider ?? settings.provider ?? (rooToken ? "roo" : "openrouter")
	const effectiveWorkspacePath = flagOptions.workspace ? path.resolve(flagOptions.workspace) : process.cwd()
	const legacyRequireApprovalFromSettings =
		settings.requireApproval ??
		(settings.dangerouslySkipPermissions === undefined ? undefined : !settings.dangerouslySkipPermissions)
	const effectiveRequireApproval = flagOptions.requireApproval || legacyRequireApprovalFromSettings || false
	const effectiveExitOnComplete = flagOptions.print || flagOptions.oneshot || settings.oneshot || false

	const extensionHostOptions: ExtensionHostOptions = {
		mode: effectiveMode,
		reasoningEffort: effectiveReasoningEffort === "unspecified" ? undefined : effectiveReasoningEffort,
		user: null,
		provider: effectiveProvider,
		model: effectiveModel,
		workspacePath: effectiveWorkspacePath,
		extensionPath: path.resolve(flagOptions.extension || getDefaultExtensionPath(__dirname)),
		nonInteractive: !effectiveRequireApproval,
		exitOnError: flagOptions.exitOnError,
		ephemeral: flagOptions.ephemeral,
		debug: flagOptions.debug,
		exitOnComplete: effectiveExitOnComplete,
	}

	// Roo Code Cloud Authentication

	if (isOnboardingEnabled) {
		let { onboardingProviderChoice } = settings

		if (!onboardingProviderChoice) {
			const { choice, token } = await runOnboarding()
			onboardingProviderChoice = choice
			rooToken = token ?? null
		}

		if (onboardingProviderChoice === OnboardingProviderChoice.Roo) {
			extensionHostOptions.provider = "roo"
		}
	}

	if (extensionHostOptions.provider === "roo") {
		if (rooToken) {
			try {
				const client = createClient({ url: SDK_BASE_URL, authToken: rooToken })
				const me = await client.auth.me.query()

				if (me?.type !== "user") {
					throw new Error("Invalid token")
				}

				extensionHostOptions.apiKey = rooToken
				extensionHostOptions.user = me.user
			} catch {
				// If an explicit API key was provided via flag or env var, fall through
				// to the general API key resolution below instead of exiting.
				if (!flagOptions.apiKey && !getApiKeyFromEnv(extensionHostOptions.provider)) {
					console.error("[CLI] Your Roo Code Router token is not valid.")
					console.error("[CLI] Please run: roo auth login")
					console.error("[CLI] Or use --api-key or set ROO_API_KEY to provide your own API key.")
					process.exit(1)
				}
			}
		}
		// If no rooToken, fall through to the general API key resolution below
		// which will check flagOptions.apiKey and ROO_API_KEY env var.
	}

	// Validations
	// TODO: Validate the API key for the chosen provider.
	// TODO: Validate the model for the chosen provider.

	if (!isSupportedProvider(extensionHostOptions.provider)) {
		console.error(
			`[CLI] Error: Invalid provider: ${extensionHostOptions.provider}; must be one of: ${supportedProviders.join(", ")}`,
		)
		process.exit(1)
	}

	extensionHostOptions.apiKey =
		extensionHostOptions.apiKey || flagOptions.apiKey || getApiKeyFromEnv(extensionHostOptions.provider)

	if (!extensionHostOptions.apiKey) {
		if (extensionHostOptions.provider === "roo") {
			console.error("[CLI] Error: Authentication with Roo Code Cloud failed or was cancelled.")
			console.error("[CLI] Please run: roo auth login")
			console.error("[CLI] Or use --api-key to provide your own API key.")
		} else {
			console.error(
				`[CLI] Error: No API key provided. Use --api-key or set the appropriate environment variable.`,
			)
			console.error(
				`[CLI] For ${extensionHostOptions.provider}, set ${getEnvVarName(extensionHostOptions.provider)}`,
			)
		}

		process.exit(1)
	}

	if (!fs.existsSync(extensionHostOptions.workspacePath)) {
		console.error(`[CLI] Error: Workspace path does not exist: ${extensionHostOptions.workspacePath}`)
		process.exit(1)
	}

	if (extensionHostOptions.reasoningEffort && !REASONING_EFFORTS.includes(extensionHostOptions.reasoningEffort)) {
		console.error(
			`[CLI] Error: Invalid reasoning effort: ${extensionHostOptions.reasoningEffort}, must be one of: ${REASONING_EFFORTS.join(", ")}`,
		)
		process.exit(1)
	}

	// Validate output format
	const outputFormat: OutputFormat = (flagOptions.outputFormat as OutputFormat) || "text"

	if (!isValidOutputFormat(outputFormat)) {
		console.error(
			`[CLI] Error: Invalid output format: ${flagOptions.outputFormat}; must be one of: text, json, stream-json`,
		)
		process.exit(1)
	}

	// Output format only works with --print mode
	if (outputFormat !== "text" && !flagOptions.print && isTuiSupported) {
		console.error("[CLI] Error: --output-format requires --print mode")
		console.error("[CLI] Usage: roo --print --output-format json")
		process.exit(1)
	}

	if (flagOptions.stdinPromptStream && !flagOptions.print) {
		console.error("[CLI] Error: --stdin-prompt-stream requires --print mode")
		console.error("[CLI] Usage: roo --print --output-format stream-json --stdin-prompt-stream [options]")
		process.exit(1)
	}

	if (flagOptions.signalOnlyExit && !flagOptions.stdinPromptStream) {
		console.error("[CLI] Error: --signal-only-exit requires --stdin-prompt-stream")
		console.error("[CLI] Usage: roo --print --output-format stream-json --stdin-prompt-stream --signal-only-exit")
		process.exit(1)
	}

	if (flagOptions.stdinPromptStream && outputFormat !== "stream-json") {
		console.error("[CLI] Error: --stdin-prompt-stream requires --output-format=stream-json")
		console.error("[CLI] Usage: roo --print --output-format stream-json --stdin-prompt-stream [options]")
		process.exit(1)
	}

	if (flagOptions.stdinPromptStream && process.stdin.isTTY) {
		console.error("[CLI] Error: --stdin-prompt-stream requires piped stdin")
		console.error(
			'[CLI] Example: printf \'{"command":"start","requestId":"1","prompt":"1+1=?"}\\n\' | roo --print --output-format stream-json --stdin-prompt-stream [options]',
		)
		process.exit(1)
	}

	if (flagOptions.stdinPromptStream && prompt) {
		console.error("[CLI] Error: cannot use positional prompt or --prompt-file with --stdin-prompt-stream")
		console.error("[CLI] Usage: roo --print --output-format stream-json --stdin-prompt-stream [options]")
		process.exit(1)
	}

	if (flagOptions.stdinPromptStream && isResumeRequested) {
		console.error("[CLI] Error: cannot use --session-id/--continue with --stdin-prompt-stream")
		console.error("[CLI] Usage: roo --print --output-format stream-json --stdin-prompt-stream [options]")
		process.exit(1)
	}

	const useStdinPromptStream = flagOptions.stdinPromptStream

	if (!isTuiEnabled) {
		if (!prompt && !useStdinPromptStream && !isResumeRequested) {
			if (flagOptions.print) {
				console.error("[CLI] Error: no prompt provided")
				console.error("[CLI] Usage: roo --print [options] <prompt>")
				console.error(
					"[CLI] For stdin control mode: roo --print --output-format stream-json --stdin-prompt-stream [options]",
				)
			} else {
				console.error("[CLI] Error: prompt is required in non-interactive mode")
				console.error("[CLI] Usage: roo <prompt> [options]")
				console.error("[CLI] Run without -p for interactive mode")
			}

			process.exit(1)
		}

		if (!flagOptions.print) {
			console.warn("[CLI] TUI disabled (no TTY support), falling back to print mode")
		}
	}

	// Run!

	if (isTuiEnabled) {
		try {
			const { render } = await import("ink")
			const { App } = await import("../../ui/App.js")

			render(
				createElement(App, {
					...extensionHostOptions,
					initialPrompt: prompt,
					initialSessionId: requestedSessionId,
					continueSession: shouldContinueSession,
					version: VERSION,
					createExtensionHost: (opts: ExtensionHostOptions) => new ExtensionHost(opts),
				}),
				// Handle Ctrl+C in App component for double-press exit.
				{ exitOnCtrlC: false },
			)
		} catch (error) {
			console.error("[CLI] Failed to start TUI:", error instanceof Error ? error.message : String(error))

			if (error instanceof Error) {
				console.error(error.stack)
			}

			process.exit(1)
		}
	} else {
		const useJsonOutput = outputFormat === "json" || outputFormat === "stream-json"
		const signalOnlyExit = flagOptions.signalOnlyExit

		extensionHostOptions.disableOutput = useJsonOutput

		const host = new ExtensionHost(extensionHostOptions)
		let streamRequestId: string | undefined
		let keepAliveInterval: NodeJS.Timeout | undefined
		let isShuttingDown = false
		let hostDisposed = false
		let taskHistorySnapshot: HistoryItem[] = []

		const onExtensionMessage = (message: unknown) => {
			const taskHistory = extractTaskHistoryFromMessage(message)
			if (taskHistory) {
				taskHistorySnapshot = taskHistory
			}
		}

		host.on("extensionWebviewMessage", onExtensionMessage)

		const jsonEmitter = useJsonOutput
			? new JsonEventEmitter({
					mode: outputFormat as "json" | "stream-json",
					requestIdProvider: () => streamRequestId,
				})
			: null

		const emitRuntimeError = (error: Error, source?: string) => {
			const errorMessage = source ? `${source}: ${error.message}` : error.message

			if (useJsonOutput) {
				const errorEvent = { type: "error", id: Date.now(), content: errorMessage }
				process.stdout.write(JSON.stringify(errorEvent) + "\n")
				return
			}

			console.error("[CLI] Error:", errorMessage)
			console.error(error.stack)
		}

		const clearKeepAliveInterval = () => {
			if (!keepAliveInterval) {
				return
			}

			clearInterval(keepAliveInterval)
			keepAliveInterval = undefined
		}

		const ensureKeepAliveInterval = () => {
			if (!signalOnlyExit || keepAliveInterval) {
				return
			}

			keepAliveInterval = setInterval(() => {}, SIGNAL_ONLY_EXIT_KEEPALIVE_MS)
		}

		const disposeHost = async () => {
			if (hostDisposed) {
				return
			}

			hostDisposed = true
			host.off("extensionWebviewMessage", onExtensionMessage)
			jsonEmitter?.detach()
			await host.dispose()
		}

		const onSigint = () => {
			void shutdown("SIGINT", 130)
		}

		const onSigterm = () => {
			void shutdown("SIGTERM", 143)
		}

		const onUncaughtException = (error: Error) => {
			emitRuntimeError(error, "uncaughtException")

			if (signalOnlyExit) {
				return
			}

			void shutdown("uncaughtException", 1)
		}

		const onUnhandledRejection = (reason: unknown) => {
			const error = normalizeError(reason)
			emitRuntimeError(error, "unhandledRejection")

			if (signalOnlyExit) {
				return
			}

			void shutdown("unhandledRejection", 1)
		}

		const parkUntilSignal = async (reason: string): Promise<never> => {
			ensureKeepAliveInterval()

			if (!useJsonOutput) {
				console.error(`[CLI] ${reason} (--signal-only-exit active; waiting for SIGINT/SIGTERM).`)
			}

			await new Promise<void>(() => {})
			throw new Error("unreachable")
		}

		async function shutdown(signal: string, exitCode: number): Promise<void> {
			if (isShuttingDown) {
				return
			}

			isShuttingDown = true
			process.off("SIGINT", onSigint)
			process.off("SIGTERM", onSigterm)
			process.off("uncaughtException", onUncaughtException)
			process.off("unhandledRejection", onUnhandledRejection)
			clearKeepAliveInterval()

			if (!useJsonOutput) {
				console.log(`\n[CLI] Received ${signal}, shutting down...`)
			}

			await disposeHost()
			process.exit(exitCode)
		}

		process.on("SIGINT", onSigint)
		process.on("SIGTERM", onSigterm)
		process.on("uncaughtException", onUncaughtException)
		process.on("unhandledRejection", onUnhandledRejection)

		try {
			await host.activate()
			if (extensionHostOptions.provider === "roo") {
				try {
					await warmRooModels(host)
				} catch (warmupError) {
					if (flagOptions.debug) {
						const message = warmupError instanceof Error ? warmupError.message : String(warmupError)
						console.error(`[CLI] Warning: Roo model warmup failed: ${message}`)
					}
				}
			}

			if (jsonEmitter) {
				jsonEmitter.attachToClient(host.client)
			}

			if (useStdinPromptStream) {
				if (!jsonEmitter || outputFormat !== "stream-json") {
					throw new Error("--stdin-prompt-stream requires --output-format=stream-json to emit control events")
				}

				await runStdinStreamMode({
					host,
					jsonEmitter,
					setStreamRequestId: (id) => {
						streamRequestId = id
					},
				})
			} else {
				if (isResumeRequested) {
					const resolvedSessionId =
						requestedSessionId ||
						getMostRecentTaskIdInWorkspace(taskHistorySnapshot, effectiveWorkspacePath)

					if (requestedSessionId && taskHistorySnapshot.length > 0) {
						const hasRequestedTask = taskHistorySnapshot.some((item) => item.id === requestedSessionId)
						if (!hasRequestedTask) {
							throw new Error(`Session not found in task history: ${requestedSessionId}`)
						}
					}

					if (!resolvedSessionId) {
						throw new Error("No previous tasks found to continue in this workspace.")
					}

					await host.resumeTask(resolvedSessionId)
				} else {
					await host.runTask(prompt!)
				}
			}

			await disposeHost()

			if (signalOnlyExit) {
				await parkUntilSignal("Task loop completed")
			}

			process.off("SIGINT", onSigint)
			process.off("SIGTERM", onSigterm)
			process.off("uncaughtException", onUncaughtException)
			process.off("unhandledRejection", onUnhandledRejection)
			process.exit(0)
		} catch (error) {
			emitRuntimeError(normalizeError(error))
			await disposeHost()

			if (signalOnlyExit) {
				await parkUntilSignal("Task loop failed")
			}

			process.off("SIGINT", onSigint)
			process.off("SIGTERM", onSigterm)
			process.off("uncaughtException", onUncaughtException)
			process.off("unhandledRejection", onUnhandledRejection)
			process.exit(1)
		}
	}
}
