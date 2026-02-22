import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import { createElement } from "react"
import pWaitFor from "p-wait-for"

import { setLogger } from "@roo-code/vscode-shim"

import {
	CliSettings,
	FlagOptions,
	isSupportedProvider,
	OnboardingProviderChoice,
	SupportedProvider,
	supportedProviders,
	DEFAULT_FLAGS,
	REASONING_EFFORTS,
	SDK_BASE_URL,
	OutputFormat,
} from "@/types/index.js"
import { isValidOutputFormat } from "@/types/json-events.js"
import { JsonEventEmitter } from "@/agent/json-event-emitter.js"

import { createClient } from "@/lib/sdk/index.js"
import { loadProviderApiKey, loadToken, loadSettings } from "@/lib/storage/index.js"
import { getEnvVarName, getApiKeyFromEnv, getProviderAuthMode } from "@/lib/utils/provider.js"
import { runOnboarding } from "@/lib/utils/onboarding.js"
import { getDefaultExtensionPath } from "@/lib/utils/extension.js"
import { VERSION } from "@/lib/utils/version.js"

import { ExtensionHost, ExtensionHostOptions } from "@/agent/index.js"
import { runStdinStreamMode } from "./stdin-stream.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type ProviderAuthentication = {
	apiKey?: string
	rooUser?: NonNullable<ExtensionHostOptions["user"]>
	needsOAuthBootstrap?: boolean
	invalidRooToken?: boolean
}

const OPENAI_CODEX_NON_INTERACTIVE_AUTH_MESSAGE =
	"openai-codex requires interactive OAuth. Run in TTY or pre-auth with roo auth login --provider openai-codex."

export async function resolveProviderAuthentication(params: {
	provider: SupportedProvider
	flagApiKey?: string
	preloadedApiKey?: string
	rooToken: string | null
	settings: CliSettings
	host?: ExtensionHost
	interactive: boolean
}): Promise<ProviderAuthentication> {
	const { provider, flagApiKey, preloadedApiKey, rooToken } = params

	const authMode = getProviderAuthMode(provider)
	const auth: ProviderAuthentication = {
		needsOAuthBootstrap: authMode === "oauth",
	}

	if (provider === "roo" && rooToken) {
		try {
			const client = createClient({ url: SDK_BASE_URL, authToken: rooToken })
			const me = await client.auth.me.query()

			if (me?.type !== "user") {
				throw new Error("Invalid token")
			}

			auth.apiKey = rooToken
			auth.rooUser = me.user
		} catch {
			auth.invalidRooToken = true
		}
	}

	auth.apiKey =
		auth.apiKey ||
		preloadedApiKey ||
		flagApiKey ||
		(await loadProviderApiKey(provider)) ||
		getApiKeyFromEnv(provider)

	return auth
}

export async function assertAuthReady(params: {
	provider: SupportedProvider
	auth: ProviderAuthentication
	interactive: boolean
}): Promise<void> {
	const { provider, auth } = params
	const authMode = getProviderAuthMode(provider)

	if (authMode === "oauth") {
		return
	}

	if (auth.apiKey) {
		return
	}

	if (authMode === "roo-token") {
		if (auth.invalidRooToken) {
			console.error("[CLI] Your Roo Code Router token is not valid.")
			console.error("[CLI] Please run: roo auth login")
			console.error("[CLI] Or use --api-key or set ROO_API_KEY to provide your own API key.")
		} else {
			console.error("[CLI] Error: Authentication with Roo Code Cloud failed or was cancelled.")
			console.error("[CLI] Please run: roo auth login")
			console.error("[CLI] Or use --api-key to provide your own API key.")
		}
	} else {
		console.error(`[CLI] Error: No API key provided. Use --api-key or set the appropriate environment variable.`)
		const envVarName = getEnvVarName(provider)
		if (envVarName) {
			console.error(`[CLI] For ${provider}, set ${envVarName}`)
		}
	}

	process.exit(1)
}

export function assertNonInteractiveOAuthReady(params: {
	provider: SupportedProvider
	interactive: boolean
	providerAuthState: { openAiCodexIsAuthenticated?: boolean }
}): void {
	if (
		params.provider === "openai-codex" &&
		!params.interactive &&
		params.providerAuthState.openAiCodexIsAuthenticated !== true
	) {
		throw new Error(OPENAI_CODEX_NON_INTERACTIVE_AUTH_MESSAGE)
	}
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
			const { choice, token, provider, apiKey } = await runOnboarding()
			onboardingProviderChoice = choice
			rooToken = token ?? null

			if (provider) {
				extensionHostOptions.provider = provider
			}

			if (apiKey) {
				extensionHostOptions.apiKey = apiKey
			}
		}

		if (onboardingProviderChoice === OnboardingProviderChoice.Roo) {
			extensionHostOptions.provider = "roo"
		}
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

	const auth = await resolveProviderAuthentication({
		provider: extensionHostOptions.provider,
		flagApiKey: flagOptions.apiKey,
		preloadedApiKey: extensionHostOptions.apiKey,
		rooToken,
		settings,
		interactive: isTuiEnabled,
	})

	extensionHostOptions.apiKey = auth.apiKey

	if (auth.rooUser) {
		extensionHostOptions.user = auth.rooUser
	}

	await assertAuthReady({
		provider: extensionHostOptions.provider,
		auth,
		interactive: isTuiEnabled,
	})

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

	const useStdinPromptStream = flagOptions.stdinPromptStream

	if (!isTuiEnabled) {
		if (!prompt && !useStdinPromptStream) {
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

		extensionHostOptions.disableOutput = useJsonOutput

		const host = new ExtensionHost(extensionHostOptions)
		let streamRequestId: string | undefined

		const jsonEmitter = useJsonOutput
			? new JsonEventEmitter({
					mode: outputFormat as "json" | "stream-json",
					requestIdProvider: () => streamRequestId,
				})
			: null

		async function shutdown(signal: string, exitCode: number): Promise<void> {
			if (!useJsonOutput) {
				console.log(`\n[CLI] Received ${signal}, shutting down...`)
			}
			jsonEmitter?.detach()
			await host.dispose()
			process.exit(exitCode)
		}

		process.on("SIGINT", () => shutdown("SIGINT", 130))
		process.on("SIGTERM", () => shutdown("SIGTERM", 143))

		try {
			await host.activate()

			if (!isTuiEnabled && extensionHostOptions.provider === "openai-codex") {
				await pWaitFor(() => host.client.getProviderAuthState().openAiCodexIsAuthenticated !== undefined, {
					interval: 25,
					timeout: 2_000,
				}).catch(() => undefined)
			}

			assertNonInteractiveOAuthReady({
				provider: extensionHostOptions.provider,
				interactive: isTuiEnabled,
				providerAuthState: host.client.getProviderAuthState(),
			})

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
				await host.runTask(prompt!)
			}

			jsonEmitter?.detach()
			await host.dispose()
			process.exit(0)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)

			if (useJsonOutput) {
				const errorEvent = { type: "error", id: Date.now(), content: errorMessage }
				process.stdout.write(JSON.stringify(errorEvent) + "\n")
			} else {
				console.error("[CLI] Error:", errorMessage)

				if (error instanceof Error) {
					console.error(error.stack)
				}
			}

			jsonEmitter?.detach()
			await host.dispose()
			process.exit(1)
		}
	}
}
