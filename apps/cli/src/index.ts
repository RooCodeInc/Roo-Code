/**
 * @roo-code/cli - Command Line Interface for Roo Code
 */

import { Command } from "commander"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import {
	type ProviderName,
	type ReasoningEffortExtended,
	isProviderName,
	reasoningEffortsExtended,
} from "@roo-code/types"
import { setLogger } from "@roo-code/vscode-shim"

import { ExtensionHost } from "./extension-host.js"
import { getEnvVarName, getApiKeyFromEnv, getDefaultExtensionPath } from "./utils.js"

const DEFAULTS = {
	mode: "code",
	reasoningEffort: "medium" as const,
	model: "anthropic/claude-opus-4.5",
}

const REASONING_EFFORTS = [...reasoningEffortsExtended, "unspecified", "disabled"]

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const program = new Command()

program.name("roo").description("Roo Code CLI - Run the Roo Code agent from the command line").version("0.1.0")

program
	.argument("<prompt>", "The prompt/task to execute")
	.option("-w, --workspace <path>", "Workspace path to operate in", process.cwd())
	.option("-e, --extension <path>", "Path to the extension bundle directory")
	.option("-v, --verbose", "Enable verbose output (show VSCode and extension logs)", false)
	.option("-d, --debug", "Enable debug output (includes detailed debug information)", false)
	.option("-x, --exit-on-complete", "Exit the process when the task completes (useful for testing)", false)
	.option("-y, --yes", "Auto-approve all prompts (non-interactive mode)", false)
	.option("-k, --api-key <key>", "API key for the LLM provider (defaults to ANTHROPIC_API_KEY env var)")
	.option("-p, --provider <provider>", "API provider (anthropic, openai, openrouter, etc.)", "openrouter")
	.option("-m, --model <model>", "Model to use", DEFAULTS.model)
	.option("-M, --mode <mode>", "Mode to start in (code, architect, ask, debug, etc.)", DEFAULTS.mode)
	.option(
		"-r, --reasoning-effort <effort>",
		"Reasoning effort level (unspecified, disabled, none, minimal, low, medium, high, xhigh)",
		DEFAULTS.reasoningEffort,
	)
	.action(
		async (
			prompt: string,
			options: {
				workspace: string
				extension?: string
				verbose: boolean
				debug: boolean
				exitOnComplete: boolean
				yes: boolean
				apiKey?: string
				provider: ProviderName
				model?: string
				mode?: string
				reasoningEffort?: ReasoningEffortExtended | "unspecified" | "disabled"
			},
		) => {
			// Default is quiet mode - suppress VSCode shim logs unless verbose
			// or debug is specified.
			if (!options.verbose && !options.debug) {
				setLogger({
					info: () => {},
					warn: () => {},
					error: () => {},
					debug: () => {},
				})
			}

			const extensionPath = options.extension || getDefaultExtensionPath(__dirname)
			const apiKey = options.apiKey || getApiKeyFromEnv(options.provider)
			const workspacePath = path.resolve(options.workspace)

			if (!apiKey) {
				console.error(
					`[CLI] Error: No API key provided. Use --api-key or set the appropriate environment variable.`,
				)
				console.error(`[CLI] For ${options.provider}, set ${getEnvVarName(options.provider)}`)
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

			console.log(`[CLI] Mode: ${options.mode || "default"}`)
			console.log(`[CLI] Reasoning Effort: ${options.reasoningEffort || "default"}`)
			console.log(`[CLI] Provider: ${options.provider}`)
			console.log(`[CLI] Model: ${options.model || "default"}`)
			console.log(`[CLI] Workspace: ${workspacePath}`)

			const host = new ExtensionHost({
				mode: options.mode || DEFAULTS.mode,
				reasoningEffort: options.reasoningEffort === "unspecified" ? undefined : options.reasoningEffort,
				apiProvider: options.provider,
				apiKey,
				model: options.model || DEFAULTS.model,
				workspacePath,
				extensionPath: path.resolve(extensionPath),
				verbose: options.debug,
				quiet: !options.verbose && !options.debug,
				nonInteractive: options.yes,
			})

			// Handle SIGINT (Ctrl+C)
			process.on("SIGINT", async () => {
				console.log("\n[CLI] Received SIGINT, shutting down...")
				await host.dispose()
				process.exit(130)
			})

			// Handle SIGTERM
			process.on("SIGTERM", async () => {
				console.log("\n[CLI] Received SIGTERM, shutting down...")
				await host.dispose()
				process.exit(143)
			})

			try {
				await host.activate()
				await host.runTask(prompt)
				await host.dispose()

				if (options.exitOnComplete) {
					process.exit(0)
				}
			} catch (error) {
				console.error("[CLI] Error:", error instanceof Error ? error.message : String(error))

				if (options.debug && error instanceof Error) {
					console.error(error.stack)
				}

				await host.dispose()
				process.exit(1)
			}
		},
	)

program.parse()
