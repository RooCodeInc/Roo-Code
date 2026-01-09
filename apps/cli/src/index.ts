import fs from "fs"
import { createRequire } from "module"
import path from "path"
import { fileURLToPath } from "url"

import { Command } from "commander"
import { createElement } from "react"

import { isProviderName } from "@roo-code/types"
import { setLogger } from "@roo-code/vscode-shim"

import { loadToken } from "./storage/credentials.js"

import { FlagOptions, isSupportedProvider, OnboardingProviderChoice, supportedProviders } from "./types.js"
import { ASCII_ROO, DEFAULT_FLAG_OPTIONS, REASONING_EFFORTS, SDK_BASE_URL } from "./constants.js"
import { ExtensionHost, ExtensionHostOptions } from "./extension-host.js"
import { login, logout, status } from "./commands/index.js"
import { getEnvVarName, getApiKeyFromEnv, getDefaultExtensionPath } from "./utils/extensionHostUtils.js"
import { runOnboarding } from "./utils/onboarding.js"
import { type User, createClient } from "./sdk/index.js"
import { hasToken, loadSettings } from "./storage/index.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const packageJson = require("../package.json")

const program = new Command()

program
	.name("roo")
	.description("Roo Code CLI - Run the Roo Code agent from the command line")
	.version(packageJson.version)

program
	.argument("[workspace]", "Workspace path to operate in", process.cwd())
	.option("-P, --prompt <prompt>", "The prompt/task to execute (optional in TUI mode)")
	.option("-e, --extension <path>", "Path to the extension bundle directory")
	.option("-d, --debug", "Enable debug output (includes detailed debug information)", false)
	.option("-y, --yes", "Auto-approve all prompts (non-interactive mode)", false)
	.option("-k, --api-key <key>", "API key for the LLM provider (defaults to OPENROUTER_API_KEY env var)")
	.option("-p, --provider <provider>", "API provider (anthropic, openai, openrouter, etc.)", "openrouter")
	.option("-m, --model <model>", "Model to use", DEFAULT_FLAG_OPTIONS.model)
	.option("-M, --mode <mode>", "Mode to start in (code, architect, ask, debug, etc.)", DEFAULT_FLAG_OPTIONS.mode)
	.option(
		"-r, --reasoning-effort <effort>",
		"Reasoning effort level (unspecified, disabled, none, minimal, low, medium, high, xhigh)",
		DEFAULT_FLAG_OPTIONS.reasoningEffort,
	)
	.option("-x, --exit-on-complete", "Exit the process when the task completes (applies to TUI mode only)", false)
	.option(
		"-w, --wait-on-complete",
		"Keep the process running when the task completes (applies to plain text mode only)",
		false,
	)
	.option("--ephemeral", "Run without persisting state (uses temporary storage)", false)
	.option("--no-tui", "Disable TUI, use plain text output")
	.action(async (workspaceArg: string, options: FlagOptions) => {
		setLogger({
			info: () => {},
			warn: () => {},
			error: () => {},
			debug: () => {},
		})

		const isTuiSupported = process.stdin.isTTY && process.stdout.isTTY
		const extensionPath = options.extension || getDefaultExtensionPath(__dirname)
		const workspacePath = path.resolve(workspaceArg)

		if (!isSupportedProvider(options.provider)) {
			console.error(
				`[CLI] Error: Invalid provider: ${options.provider}; must be one of: ${supportedProviders.join(", ")}`,
			)

			process.exit(1)
		}

		let apiKey = options.apiKey || getApiKeyFromEnv(options.provider)
		let provider = options.provider
		let user: User | null = null
		let useCloudProvider = false

		if (isTuiSupported) {
			let { onboardingProviderChoice } = await loadSettings()

			if (!onboardingProviderChoice) {
				const result = await runOnboarding()
				onboardingProviderChoice = result.choice
			}

			if (onboardingProviderChoice === OnboardingProviderChoice.Roo) {
				useCloudProvider = true
				const authenticated = await hasToken()

				if (authenticated) {
					const token = await loadToken()

					if (token) {
						const client = createClient({ url: SDK_BASE_URL, authToken: token })
						const me = await client.auth.me.query()
						apiKey = token
						provider = "roo"
						user = me?.type === "user" ? me.user : null
					}
				}
			}
		}

		if (!apiKey) {
			if (useCloudProvider) {
				console.error("[CLI] Error: Authentication with Roo Code Cloud failed or was cancelled.")
				console.error("[CLI] Please run: roo auth login")
				console.error("[CLI] Or use --api-key to provide your own API key.")
			} else {
				console.error(
					`[CLI] Error: No API key provided. Use --api-key or set the appropriate environment variable.`,
				)
				console.error(`[CLI] For ${provider}, set ${getEnvVarName(provider)}`)
			}
			process.exit(1)
		}

		if (!fs.existsSync(workspacePath)) {
			console.error(`[CLI] Error: Workspace path does not exist: ${workspacePath}`)
			process.exit(1)
		}

		if (!isProviderName(options.provider)) {
			console.error(`[CLI] Error: Invalid provider: ${options.provider}`)
			process.exit(1)
		}

		if (options.reasoningEffort && !REASONING_EFFORTS.includes(options.reasoningEffort)) {
			console.error(
				`[CLI] Error: Invalid reasoning effort: ${options.reasoningEffort}, must be one of: ${REASONING_EFFORTS.join(", ")}`,
			)
			process.exit(1)
		}

		const useTui = options.tui && isTuiSupported

		if (options.tui && !isTuiSupported) {
			console.log("[CLI] TUI disabled (no TTY support), falling back to plain text mode")
		}

		if (!useTui && !options.prompt) {
			console.error("[CLI] Error: prompt is required in plain text mode")
			console.error("[CLI] Usage: roo [workspace] -P <prompt> [options]")
			console.error("[CLI] Use TUI mode (without --no-tui) for interactive input")
			process.exit(1)
		}

		if (useTui) {
			try {
				const { render } = await import("ink")
				const { App } = await import("./ui/App.js")

				render(
					createElement(App, {
						initialPrompt: options.prompt || "",
						workspacePath: workspacePath,
						extensionPath: path.resolve(extensionPath),
						user,
						provider,
						apiKey,
						model: options.model || DEFAULT_FLAG_OPTIONS.model,
						mode: options.mode || DEFAULT_FLAG_OPTIONS.mode,
						nonInteractive: options.yes,
						debug: options.debug,
						exitOnComplete: options.exitOnComplete,
						reasoningEffort: options.reasoningEffort,
						ephemeral: options.ephemeral,
						version: packageJson.version,
						// Create extension host factory for dependency injection.
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
			console.log(ASCII_ROO)
			console.log()
			console.log(
				`[roo] Running ${options.model || "default"} (${options.reasoningEffort || "default"}) on ${provider} in ${options.mode || "default"} mode in ${workspacePath}`,
			)

			const host = new ExtensionHost({
				mode: options.mode || DEFAULT_FLAG_OPTIONS.mode,
				reasoningEffort: options.reasoningEffort === "unspecified" ? undefined : options.reasoningEffort,
				user,
				provider,
				apiKey,
				model: options.model || DEFAULT_FLAG_OPTIONS.model,
				workspacePath,
				extensionPath: path.resolve(extensionPath),
				nonInteractive: options.yes,
				ephemeral: options.ephemeral,
			})

			process.on("SIGINT", async () => {
				console.log("\n[CLI] Received SIGINT, shutting down...")
				await host.dispose()
				process.exit(130)
			})

			process.on("SIGTERM", async () => {
				console.log("\n[CLI] Received SIGTERM, shutting down...")
				await host.dispose()
				process.exit(143)
			})

			try {
				await host.activate()
				await host.runTask(options.prompt!)
				await host.dispose()

				if (!options.waitOnComplete) {
					process.exit(0)
				}
			} catch (error) {
				console.error("[CLI] Error:", error instanceof Error ? error.message : String(error))

				if (error instanceof Error) {
					console.error(error.stack)
				}

				await host.dispose()
				process.exit(1)
			}
		}
	})

// Auth command group
const authCommand = program.command("auth").description("Manage authentication for Roo Code Cloud")

authCommand
	.command("login")
	.description("Authenticate with Roo Code Cloud")
	.option("-v, --verbose", "Enable verbose output", false)
	.action(async (options: { verbose: boolean }) => {
		const result = await login({ verbose: options.verbose })
		process.exit(result.success ? 0 : 1)
	})

authCommand
	.command("logout")
	.description("Log out from Roo Code Cloud")
	.option("-v, --verbose", "Enable verbose output", false)
	.action(async (options: { verbose: boolean }) => {
		const result = await logout({ verbose: options.verbose })
		process.exit(result.success ? 0 : 1)
	})

authCommand
	.command("status")
	.description("Show authentication status")
	.option("-v, --verbose", "Enable verbose output", false)
	.action(async (options: { verbose: boolean }) => {
		const result = await status({ verbose: options.verbose })
		process.exit(result.authenticated ? 0 : 1)
	})

program.parse()
