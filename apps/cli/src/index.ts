/**
 * @roo-code/cli - Command Line Interface for Roo Code
 *
 * This CLI allows you to run the Roo Code agent from the command line,
 * without needing VSCode installed.
 */

import { Command } from "commander"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"
import { ExtensionHost } from "./extension-host.js"
import { setLogger } from "@roo-code/vscode-shim"

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

			const extensionPath = options.extension || getDefaultExtensionPath()

			// Get API key from option or environment variable
			const apiKey = options.apiKey || getApiKeyFromEnv(options.provider)

			if (!apiKey) {
				console.error(
					`[CLI] Error: No API key provided. Use --api-key or set the appropriate environment variable.`,
				)
				console.error(`[CLI] For ${options.provider}, set ${getEnvVarName(options.provider)}`)
				process.exit(1)
			}

			if (options.verbose) {
				console.log(`[CLI] Prompt: ${prompt}`)
				console.log(`[CLI] Workspace: ${options.workspace}`)
				console.log(`[CLI] Extension path: ${extensionPath}`)
				console.log(`[CLI] Provider: ${options.provider}`)
				console.log(`[CLI] Model: ${options.model || "default"}`)
				console.log(`[CLI] API Key: ${apiKey.substring(0, 8)}...`)
			}

			const host = new ExtensionHost({
				workspacePath: path.resolve(options.workspace),
				extensionPath: path.resolve(extensionPath),
				verbose: options.verbose, // Allow verbose with quiet mode for debug output
				quiet: options.quiet,
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

/**
 * Get the default path to the extension bundle.
 * This assumes the CLI is installed alongside the built extension.
 */
function getDefaultExtensionPath(): string {
	// __dirname is apps/cli/dist when bundled
	// The extension is at src/dist (relative to monorepo root)
	// So from apps/cli/dist, we need to go ../../../src/dist
	const monorepoPath = path.resolve(__dirname, "../../../src/dist")

	// Try monorepo path first (for development)
	if (fs.existsSync(path.join(monorepoPath, "extension.js"))) {
		return monorepoPath
	}

	// Fallback: when installed as npm package, extension might be at ../extension
	const packagePath = path.resolve(__dirname, "../extension")
	return packagePath
}

/**
 * Get API key from environment variable based on provider
 */
function getApiKeyFromEnv(provider: string): string | undefined {
	const envVar = getEnvVarName(provider)
	return process.env[envVar]
}

/**
 * Get the environment variable name for a provider's API key
 */
function getEnvVarName(provider: string): string {
	const envVarMap: Record<string, string> = {
		anthropic: "ANTHROPIC_API_KEY",
		openai: "OPENAI_API_KEY",
		openrouter: "OPENROUTER_API_KEY",
		google: "GOOGLE_API_KEY",
		gemini: "GOOGLE_API_KEY",
		bedrock: "AWS_ACCESS_KEY_ID",
		ollama: "OLLAMA_API_KEY",
		mistral: "MISTRAL_API_KEY",
		deepseek: "DEEPSEEK_API_KEY",
	}
	return envVarMap[provider.toLowerCase()] || `${provider.toUpperCase()}_API_KEY`
}
