/**
 * @roo-code/cli - Command Line Interface for Roo Code
 *
 * This CLI allows you to run the Roo Code agent from the command line,
 * without needing VSCode installed.
 */

import { Command } from "commander"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { ExtensionHost } from "./extension-host.js"
import { setLogger } from "@roo-code/vscode-shim"
import { getEnvVarName, getApiKeyFromEnv, getDefaultExtensionPath } from "./utils.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const program = new Command()

program.name("roo").description("Roo Code CLI - Run the Roo Code agent from the command line").version("0.1.0")

program
	.argument("<prompt>", "The prompt/task to execute")
	.option("-w, --workspace <path>", "Workspace path to operate in", process.cwd())
	.option("-e, --extension <path>", "Path to the extension bundle directory")
	.option("-v, --verbose", "Enable verbose logging", false)
	.option("-q, --quiet", "Suppress VSCode and extension logs (only show assistant output)", false)
	.option("-x, --exit-on-complete", "Exit the process when the task completes (useful for testing)", false)
	.option("-y, --yes", "Auto-approve all prompts (non-interactive mode)", false)
	.option("-k, --api-key <key>", "API key for the LLM provider (defaults to ANTHROPIC_API_KEY env var)")
	.option("-p, --provider <provider>", "API provider (anthropic, openai, openrouter, etc.)", "anthropic")
	.option("-m, --model <model>", "Model to use")
	.action(
		async (
			prompt: string,
			options: {
				workspace: string
				extension?: string
				verbose: boolean
				quiet: boolean
				exitOnComplete: boolean
				yes: boolean
				apiKey?: string
				provider: string
				model?: string
			},
		) => {
			// Set up quiet mode - suppress VSCode shim logs
			if (options.quiet) {
				setLogger({
					info: () => {},
					warn: () => {},
					error: () => {},
					debug: () => {},
				})
			}

			const extensionPath = options.extension || getDefaultExtensionPath(__dirname)

			// Get API key from option or environment variable
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

			if (options.verbose) {
				console.log(`[CLI] Prompt: ${prompt}`)
				console.log(`[CLI] Workspace: ${workspacePath}`)
				console.log(`[CLI] Extension path: ${extensionPath}`)
				console.log(`[CLI] Provider: ${options.provider}`)
				console.log(`[CLI] Model: ${options.model || "default"}`)
				console.log(`[CLI] API Key: ${apiKey.substring(0, 8)}...`)
			}

			const host = new ExtensionHost({
				workspacePath,
				extensionPath: path.resolve(extensionPath),
				verbose: options.verbose, // Allow verbose with quiet mode for debug output
				quiet: options.quiet,
				nonInteractive: options.yes,
				apiKey,
				apiProvider: options.provider,
				model: options.model,
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
				if (options.verbose && error instanceof Error) {
					console.error(error.stack)
				}
				await host.dispose()
				process.exit(1)
			}
		},
	)

program.parse()
