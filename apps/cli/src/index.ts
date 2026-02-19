import { Command } from "commander"

import { DEFAULT_FLAGS } from "@/types/constants.js"
import { VERSION } from "@/lib/utils/version.js"
import { run, login, logout, status, listCommands, listModes, listModels } from "@/commands/index.js"

const program = new Command()

program
	.name("roo")
	.description("Roo Code CLI - starts an interactive session by default, use -p/--print for non-interactive output")
	.version(VERSION)

program
	.argument("[prompt]", "Your prompt")
	.option("--prompt-file <path>", "Read prompt from a file instead of command line argument")
	.option("-w, --workspace <path>", "Workspace directory path (defaults to current working directory)")
	.option("-p, --print", "Print response and exit (non-interactive mode)", false)
	.option(
		"--stdin-prompt-stream",
		"Read NDJSON commands from stdin (requires --print and --output-format stream-json)",
		false,
	)
	.option("-e, --extension <path>", "Path to the extension bundle directory")
	.option("-d, --debug", "Enable debug output (includes detailed debug information)", false)
	.option("-a, --require-approval", "Require manual approval for actions", false)
	.option("-k, --api-key <key>", "API key for the LLM provider")
	.option("--provider <provider>", "API provider (roo, anthropic, openai, openrouter, etc.)")
	.option("-m, --model <model>", "Model to use", DEFAULT_FLAGS.model)
	.option("--mode <mode>", "Mode to start in (code, architect, ask, debug, etc.)", DEFAULT_FLAGS.mode)
	.option(
		"-r, --reasoning-effort <effort>",
		"Reasoning effort level (unspecified, disabled, none, minimal, low, medium, high, xhigh)",
		DEFAULT_FLAGS.reasoningEffort,
	)
	.option("--exit-on-error", "Exit on API request errors instead of retrying", false)
	.option("--ephemeral", "Run without persisting state (uses temporary storage)", false)
	.option("--oneshot", "Exit upon task completion", false)
	.option(
		"--output-format <format>",
		'Output format (only works with --print): "text" (default), "json" (single result), or "stream-json" (realtime streaming)',
		"text",
	)
	.action(run)

const listCommand = program.command("list").description("List commands, modes, or models")

const applyListOptions = (command: Command) =>
	command
		.option("-w, --workspace <path>", "Workspace directory path (defaults to current working directory)")
		.option("-e, --extension <path>", "Path to the extension bundle directory")
		.option("-k, --api-key <key>", "Roo API key (falls back to saved login/session token)")
		.option("--format <format>", 'Output format: "json" (default) or "text"', "json")
		.option("-d, --debug", "Enable debug output", false)

const runListAction = async (action: () => Promise<void>) => {
	try {
		await action()
		process.exit(0)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error(`[CLI] Error: ${message}`)
		process.exit(1)
	}
}

applyListOptions(listCommand.command("commands").description("List available slash commands")).action(
	async (options: Parameters<typeof listCommands>[0]) => {
		await runListAction(() => listCommands(options))
	},
)

applyListOptions(listCommand.command("modes").description("List available modes")).action(
	async (options: Parameters<typeof listModes>[0]) => {
		await runListAction(() => listModes(options))
	},
)

applyListOptions(listCommand.command("models").description("List available Roo models")).action(
	async (options: Parameters<typeof listModels>[0]) => {
		await runListAction(() => listModels(options))
	},
)

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
