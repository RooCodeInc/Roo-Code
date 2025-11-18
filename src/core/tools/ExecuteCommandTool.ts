import fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import delay from "delay"

import { CommandExecutionStatus, DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Task } from "../task/Task"

import { ToolUse, ToolResponse } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { unescapeHtmlEntities } from "../../utils/text-normalization"
import { ExitCodeDetails, RooTerminalCallbacks, RooTerminalProcess } from "../../integrations/terminal/types"
import { TerminalRegistry } from "../../integrations/terminal/TerminalRegistry"
import { Terminal } from "../../integrations/terminal/Terminal"
import { ServiceManager, ServiceHandle } from "../../integrations/terminal/ServiceManager"
import { Package } from "../../shared/package"
import { t } from "../../i18n"
import { BaseTool, ToolCallbacks } from "./BaseTool"

class ShellIntegrationError extends Error {}

interface ExecuteCommandParams {
	command: string
	cwd?: string
}

export class ExecuteCommandTool extends BaseTool<"execute_command"> {
	readonly name = "execute_command" as const

	parseLegacy(params: Partial<Record<string, string>>): ExecuteCommandParams {
		return {
			command: params.command || "",
			cwd: params.cwd,
		}
	}

	async execute(params: ExecuteCommandParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { command, cwd: customCwd } = params
		const { handleError, pushToolResult, askApproval, removeClosingTag } = callbacks

		try {
			if (!command) {
				task.consecutiveMistakeCount++
				task.recordToolError("execute_command")
				pushToolResult(await task.sayAndCreateMissingParamError("execute_command", "command"))
				return
			}

			const ignoredFileAttemptedToAccess = task.rooIgnoreController?.validateCommand(command)

			if (ignoredFileAttemptedToAccess) {
				await task.say("rooignore_error", ignoredFileAttemptedToAccess)
				pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(ignoredFileAttemptedToAccess)))
				return
			}

			task.consecutiveMistakeCount = 0

			const unescapedCommand = unescapeHtmlEntities(command)
			const didApprove = await askApproval("command", unescapedCommand)

			if (!didApprove) {
				return
			}

			const executionId = task.lastMessageTs?.toString() ?? Date.now().toString()
			const provider = await task.providerRef.deref()
			const providerState = await provider?.getState()

			const {
				terminalOutputLineLimit = 500,
				terminalOutputCharacterLimit = DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
				terminalShellIntegrationDisabled = true,
			} = providerState ?? {}

			// Get command execution timeout from VSCode configuration (in seconds)
			const commandExecutionTimeoutSeconds = vscode.workspace
				.getConfiguration(Package.name)
				.get<number>("commandExecutionTimeout", 0)

			// Get command timeout allowlist from VSCode configuration
			const commandTimeoutAllowlist = vscode.workspace
				.getConfiguration(Package.name)
				.get<string[]>("commandTimeoutAllowlist", [])

			// Check if command matches any prefix in the allowlist
			const isCommandAllowlisted = commandTimeoutAllowlist.some((prefix) =>
				unescapedCommand.startsWith(prefix.trim()),
			)

			// Convert seconds to milliseconds for internal use, but skip timeout if command is allowlisted
			const commandExecutionTimeout = isCommandAllowlisted ? 0 : commandExecutionTimeoutSeconds * 1000

			// Detect if command is a service command
			const isServiceCommand = this.detectServiceCommand(unescapedCommand)
			const readyPattern = isServiceCommand ? this.getReadyPattern(unescapedCommand) : undefined
			const readyTimeoutMs = isServiceCommand ? 60000 : undefined
			// For services like Docker that may need longer startup time, set longer timeout
			const extendedTimeoutMs =
				isServiceCommand && (unescapedCommand.includes("docker") || unescapedCommand.includes("compose"))
					? 120000
					: readyTimeoutMs

			const options: ExecuteCommandOptions = {
				executionId,
				command: unescapedCommand,
				customCwd,
				terminalShellIntegrationDisabled,
				terminalOutputLineLimit,
				terminalOutputCharacterLimit,
				commandExecutionTimeout,
				mode: isServiceCommand ? "service" : "oneshot",
				readyPattern,
				readyTimeoutMs: extendedTimeoutMs,
			}

			try {
				const [rejected, result] = await executeCommandInTerminal(task, options)

				if (rejected) {
					task.didRejectTool = true
				}

				pushToolResult(result)
			} catch (error: unknown) {
				const status: CommandExecutionStatus = { executionId, status: "fallback" }
				provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })
				await task.say("shell_integration_warning")

				if (error instanceof ShellIntegrationError) {
					const [rejected, result] = await executeCommandInTerminal(task, {
						...options,
						terminalShellIntegrationDisabled: true,
					})

					if (rejected) {
						task.didRejectTool = true
					}

					pushToolResult(result)
				} else {
					pushToolResult(`Command failed to execute in terminal due to a shell integration error.`)
				}
			}

			return
		} catch (error) {
			await handleError("executing command", error as Error)
			return
		}
	}

	override async handlePartial(task: Task, block: ToolUse<"execute_command">): Promise<void> {
		const command = block.params.command
		await task
			.ask("command", this.removeClosingTag("command", command, block.partial), block.partial)
			.catch(() => {})
	}

	/**
	 * Detect if command is a service command (long-running service)
	 */
	private detectServiceCommand(command: string): boolean {
		const servicePatterns = [
			// JavaScript/TypeScript/Node.js
			/npm\s+run\s+(dev|start|serve)/i,
			/yarn\s+(dev|start|serve)/i,
			/pnpm\s+(dev|start|serve)/i,
			/vite(\s+dev)?/i,
			/next\s+(dev|start)/i,
			/nuxt\s+(dev|start)/i,
			/nest\s+start(:dev)?/i,
			/react-scripts\s+start/i,
			/webpack(-dev-server)?\s+(serve|start)/i,
			/parcel\s+(serve|watch)/i,
			/rollup\s+(-w|--watch)/i,
			/(ts-node-dev|nodemon|tsx)\s+(watch|dev)/i,
			/ng\s+serve/i, // Angular
			/ember\s+serve/i, // Ember
			/gatsby\s+develop/i, // Gatsby
			// Python
			/python3?\s+manage\.py\s+runserver/i, // Django - more precise, avoid matching test_manage.py
			/django-admin\s+runserver/i,
			/uvicorn.*(--reload|dev)/i,
			/flask\s+(run|--debug)/i,
			/fastapi\s+(dev|run)/i,
			/gunicorn.*--reload/i,
			/python.*-m\s+http\.server/i,
			/streamlit\s+run/i,
			/jupyter\s+(notebook|lab)/i,
			// Ruby
			/rails\s+(server|s)/i,
			/rackup/i,
			/(puma|unicorn|thin|passenger)\s+start/i,
			// Java
			/mvn.*spring-boot:run/i,
			/mvn.*(jetty|tomcat7):run/i,
			/gradle\s+bootRun/i,
			/gradle\s+run\b/i, // Use \b to ensure run is a separate word, avoid matching "test run"
			/\.\/gradlew\s+bootRun/i,
			// Go
			/air(\s+start)?/i,
			/fresh(\s+start)?/i,
			/realize\s+start/i,
			/bee\s+run/i,
			/buffalo\s+dev/i,
			// Rust
			/trunk\s+serve/i,
			/dx\s+serve/i,
			// PHP
			/php\s+artisan\s+serve/i,
			/php\s+-S\s+localhost/i,
			/symfony\s+server:start/i,
			/composer\s+serve/i,
			// C#/.NET
			/dotnet\s+(run|watch\s+run)/i,
			/dotnet\s+(run|watch\s+run)\s+.*--project/i, // dotnet run --project or dotnet watch run --project
			/dotnet\s+.*--project\s+[^\s]+\s+run\b/i, // dotnet --project <file> run (more precise, avoid matching build run)
			// Dart/Flutter
			/flutter\s+run/i,
			/dart\s+run/i,
			/dart.*pub.*serve/i,
			// Swift
			/swift\s+run/i, // Vapor etc.
			/vapor\s+serve/i,
			// Kotlin
			/\.\/gradlew\s+run\b/i, // Ktor etc. - use \b to ensure run is a separate word
			/mvn.*kotlin:run/i,
			// Elixir
			/mix\s+phx\.server/i,
			/mix\s+phoenix\.server/i,
			/iex.*-S.*mix/i,
			// Clojure
			/lein\s+(run|ring\s+server)/i,
			/boot\s+dev/i,
			// Scala
			/sbt\s+(run|~run)/i,
			/activator\s+run/i,
			// Haskell
			/stack\s+exec.*yesod\s+devel/i,
			/cabal\s+run/i,
			// Other tools/frameworks
			/docker-compose\s+up/i, // Development environment
			/docker\s+compose\s+up/i, // docker compose up (new version syntax)
			/docker\s+up\s+-d/i, // docker up -d (more precise, avoid matching "docker ps up -d")
			/hugo\s+server/i,
			/jekyll\s+serve/i,
			/hexo\s+server/i,
			/mkdocs\s+serve/i,
			/sphinx-autobuild/i,
		]

		return servicePatterns.some((pattern) => pattern.test(command))
	}

	/**
	 * Return default ready pattern based on command
	 */
	private getReadyPattern(command: string): string | undefined {
		const lowerCommand = command.toLowerCase()

		// JavaScript/TypeScript
		if (lowerCommand.includes("vite") || lowerCommand.includes("next dev") || lowerCommand.includes("nuxt dev")) {
			return "Local:.*http://localhost|ready in|compiled successfully"
		}
		if (lowerCommand.includes("react-scripts") || lowerCommand.includes("webpack")) {
			return "Compiled successfully|webpack compiled|webpack.*compiled"
		}
		if (lowerCommand.includes("angular") || lowerCommand.includes("ng serve")) {
			return "Compiled successfully|Application bundle generation complete"
		}
		if (lowerCommand.includes("nest")) {
			return "Nest application successfully started"
		}

		// Python
		if (lowerCommand.includes("manage.py") || lowerCommand.includes("django")) {
			return "Starting development server|Django version|System check identified"
		}
		if (lowerCommand.includes("flask")) {
			return "Running on|Debug mode: on|\\* Debugger is active!"
		}
		if (lowerCommand.includes("uvicorn") || lowerCommand.includes("fastapi")) {
			return "Uvicorn running on|Application startup complete|Started server process"
		}
		if (lowerCommand.includes("streamlit")) {
			return "You can now view your Streamlit app|Network URL:"
		}
		if (lowerCommand.includes("jupyter")) {
			return "The Jupyter Notebook is running at|JupyterLab is running at"
		}

		// Ruby
		if (lowerCommand.includes("rails")) {
			return "Listening on|Rails|=> Booting"
		}
		if (lowerCommand.includes("rack") || lowerCommand.includes("puma")) {
			return "Listening on|puma.*listening"
		}

		// Java
		if (lowerCommand.includes("spring-boot") || lowerCommand.includes("bootRun")) {
			return "Started.*Application|Tomcat started on port|Netty started on port"
		}
		if (lowerCommand.includes("jetty")) {
			return "Started ServerConnector"
		}

		// Go
		if (lowerCommand.includes("bee")) {
			return "http server Running on"
		}

		// PHP
		if (lowerCommand.includes("artisan") || lowerCommand.includes("laravel")) {
			return "Laravel development server started|Development Server.*started"
		}
		if (lowerCommand.includes("symfony")) {
			return "Server listening on"
		}

		// C#/.NET
		if (lowerCommand.includes("dotnet")) {
			return "Now listening on:|Application started|Hosting environment:"
		}

		// Dart/Flutter
		if (lowerCommand.includes("flutter")) {
			return "Flutter run key commands|An Observatory debugger|✓ Built"
		}

		// Elixir
		if (lowerCommand.includes("phx") || lowerCommand.includes("phoenix")) {
			return "Phoenix.*running|Server running at"
		}

		// Docker
		if (lowerCommand.includes("docker")) {
			return "Container.*started|Attaching to"
		}

		// Generic fallback pattern
		return "listening on|server started|ready|started|running on"
	}
}

export type ExecuteCommandOptions = {
	executionId: string
	command: string
	customCwd?: string
	terminalShellIntegrationDisabled?: boolean
	terminalOutputLineLimit?: number
	terminalOutputCharacterLimit?: number
	commandExecutionTimeout?: number
	mode?: "oneshot" | "service"
	serviceId?: string
	readyPattern?: string | RegExp
	readyTimeoutMs?: number
	healthCheckUrl?: string
	healthCheckIntervalMs?: number
}

export async function executeCommandInTerminal(
	task: Task,
	{
		executionId,
		command,
		customCwd,
		terminalShellIntegrationDisabled = true,
		terminalOutputLineLimit = 500,
		terminalOutputCharacterLimit = DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
		commandExecutionTimeout = 0,
		mode = "oneshot",
		readyPattern,
		readyTimeoutMs = 60000,
		healthCheckUrl,
		healthCheckIntervalMs = 1000,
	}: ExecuteCommandOptions,
): Promise<[boolean, ToolResponse]> {
	// Convert milliseconds back to seconds for display purposes.
	const commandExecutionTimeoutSeconds = commandExecutionTimeout / 1000
	let workingDir: string

	// If service mode, use ServiceManager to start service
	if (mode === "service") {
		return await executeServiceCommand(
			task,
			{
				executionId,
				command,
				customCwd,
				workingDir: undefined, // Will be calculated below
				readyPattern,
				readyTimeoutMs,
				healthCheckUrl,
				healthCheckIntervalMs,
			},
			terminalOutputLineLimit,
			terminalOutputCharacterLimit,
		)
	}

	if (!customCwd) {
		workingDir = task.cwd
	} else if (path.isAbsolute(customCwd)) {
		workingDir = customCwd
	} else {
		workingDir = path.resolve(task.cwd, customCwd)
	}

	try {
		await fs.access(workingDir)
	} catch (error) {
		return [false, `Working directory '${workingDir}' does not exist.`]
	}

	let message: { text?: string; images?: string[] } | undefined
	let runInBackground = false
	let completed = false
	let result: string = ""
	let exitDetails: ExitCodeDetails | undefined
	let shellIntegrationError: string | undefined
	let hasAskedForCommandOutput = false

	const terminalProvider = terminalShellIntegrationDisabled ? "execa" : "vscode"
	const provider = await task.providerRef.deref()

	let accumulatedOutput = ""
	const callbacks: RooTerminalCallbacks = {
		onLine: async (lines: string, process: RooTerminalProcess) => {
			accumulatedOutput += lines
			const compressedOutput = Terminal.compressTerminalOutput(
				accumulatedOutput,
				terminalOutputLineLimit,
				terminalOutputCharacterLimit,
			)
			const status: CommandExecutionStatus = { executionId, status: "output", output: compressedOutput }
			provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })

			if (runInBackground || hasAskedForCommandOutput) {
				return
			}

			// Mark that we've asked to prevent multiple concurrent asks
			hasAskedForCommandOutput = true

			try {
				const { response, text, images } = await task.ask("command_output", "")
				runInBackground = true

				if (response === "messageResponse") {
					message = { text, images }
					process.continue()
				}
			} catch (_error) {
				// Silently handle ask errors (e.g., "Current ask promise was ignored")
			}
		},
		onCompleted: (output: string | undefined) => {
			result = Terminal.compressTerminalOutput(
				output ?? "",
				terminalOutputLineLimit,
				terminalOutputCharacterLimit,
			)

			task.say("command_output", result)
			completed = true
		},
		onShellExecutionStarted: (pid: number | undefined) => {
			const status: CommandExecutionStatus = { executionId, status: "started", pid, command }
			provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })
		},
		onShellExecutionComplete: (details: ExitCodeDetails) => {
			const status: CommandExecutionStatus = { executionId, status: "exited", exitCode: details.exitCode }
			provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })
			exitDetails = details
		},
	}

	if (terminalProvider === "vscode") {
		callbacks.onNoShellIntegration = async (error: string) => {
			TelemetryService.instance.captureShellIntegrationError(task.taskId)
			shellIntegrationError = error
		}
	}

	const terminal = await TerminalRegistry.getOrCreateTerminal(workingDir, task.taskId, terminalProvider)

	if (terminal instanceof Terminal) {
		terminal.terminal.show(true)

		// Update the working directory in case the terminal we asked for has
		// a different working directory so that the model will know where the
		// command actually executed.
		workingDir = terminal.getCurrentWorkingDirectory()
	}

	const process = terminal.runCommand(command, callbacks)
	task.terminalProcess = process

	// Implement command execution timeout (skip if timeout is 0).
	if (commandExecutionTimeout > 0) {
		let timeoutId: NodeJS.Timeout | undefined
		let isTimedOut = false

		const timeoutPromise = new Promise<void>((_, reject) => {
			timeoutId = setTimeout(async () => {
				isTimedOut = true
				await task.terminalProcess?.abort()
				reject(new Error(`Command execution timed out after ${commandExecutionTimeout}ms`))
			}, commandExecutionTimeout)
		})

		try {
			await Promise.race([process, timeoutPromise])
		} catch (error) {
			if (isTimedOut) {
				const status: CommandExecutionStatus = { executionId, status: "timeout" }
				provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })
				await task.say("error", t("common:errors:command_timeout", { seconds: commandExecutionTimeoutSeconds }))
				task.terminalProcess = undefined

				return [
					false,
					`The command was terminated after exceeding a user-configured ${commandExecutionTimeoutSeconds}s timeout. Do not try to re-run the command.`,
				]
			}
			throw error
		} finally {
			if (timeoutId) {
				clearTimeout(timeoutId)
			}

			task.terminalProcess = undefined
		}
	} else {
		// No timeout - just wait for the process to complete.
		try {
			await process
		} finally {
			task.terminalProcess = undefined
		}
	}

	if (shellIntegrationError) {
		throw new ShellIntegrationError(shellIntegrationError)
	}

	// Wait for a short delay to ensure all messages are sent to the webview.
	// This delay allows time for non-awaited promises to be created and
	// for their associated messages to be sent to the webview, maintaining
	// the correct order of messages (although the webview is smart about
	// grouping command_output messages despite any gaps anyways).
	await delay(50)

	if (message) {
		const { text, images } = message
		await task.say("user_feedback", text, images)

		return [
			true,
			formatResponse.toolResult(
				[
					`Command is still running in terminal from '${terminal.getCurrentWorkingDirectory().toPosix()}'.`,
					result.length > 0 ? `Here's the output so far:\n${result}\n` : "\n",
					`The user provided the following feedback:`,
					`<feedback>\n${text}\n</feedback>`,
				].join("\n"),
				images,
			),
		]
	} else if (completed || exitDetails) {
		let exitStatus: string = ""

		if (exitDetails !== undefined) {
			if (exitDetails.signalName) {
				exitStatus = `Process terminated by signal ${exitDetails.signalName}`

				if (exitDetails.coreDumpPossible) {
					exitStatus += " - core dump possible"
				}
			} else if (exitDetails.exitCode === undefined) {
				result += "<VSCE exit code is undefined: terminal output and command execution status is unknown.>"
				exitStatus = `Exit code: <undefined, notify user>`
			} else {
				if (exitDetails.exitCode !== 0) {
					exitStatus += "Command execution was not successful, inspect the cause and adjust as needed.\n"
				}

				exitStatus += `Exit code: ${exitDetails.exitCode}`
			}
		} else {
			result += "<VSCE exitDetails == undefined: terminal output and command execution status is unknown.>"
			exitStatus = `Exit code: <undefined, notify user>`
		}

		let workingDirInfo = ` within working directory '${terminal.getCurrentWorkingDirectory().toPosix()}'`

		return [false, `Command executed in terminal ${workingDirInfo}. ${exitStatus}\nOutput:\n${result}`]
	} else {
		return [
			false,
			[
				`Command is still running in terminal ${workingDir ? ` from '${workingDir.toPosix()}'` : ""}.`,
				result.length > 0 ? `Here's the output so far:\n${result}\n` : "\n",
				"You will be updated on the terminal status and new output in the future.",
			].join("\n"),
		]
	}
}

/**
 * Execute command in service mode
 */
async function executeServiceCommand(
	task: Task,
	options: {
		executionId: string
		command: string
		customCwd?: string
		workingDir?: string
		readyPattern?: string | RegExp
		readyTimeoutMs: number
		healthCheckUrl?: string
		healthCheckIntervalMs: number
	},
	terminalOutputLineLimit: number,
	terminalOutputCharacterLimit: number,
): Promise<[boolean, ToolResponse]> {
	const { executionId, command, customCwd, readyPattern, readyTimeoutMs, healthCheckUrl, healthCheckIntervalMs } =
		options

	let workingDir: string
	if (!customCwd) {
		workingDir = task.cwd
	} else if (path.isAbsolute(customCwd)) {
		workingDir = customCwd
	} else {
		workingDir = path.resolve(task.cwd, customCwd)
	}

	try {
		await fs.access(workingDir)
	} catch (error) {
		return [false, `Working directory '${workingDir}' does not exist.`]
	}

	const provider = await task.providerRef.deref()

	// Start service
	let serviceHandle: ServiceHandle
	try {
		serviceHandle = await ServiceManager.startService(command, workingDir, {
			readyPattern,
			readyTimeoutMs,
			healthCheckUrl,
			healthCheckIntervalMs,
		})

		// Send service started status
		const status: CommandExecutionStatus = {
			executionId,
			status: "service_started",
			serviceId: serviceHandle.serviceId,
			pid: serviceHandle.pid,
		}
		provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		const status: CommandExecutionStatus = {
			executionId,
			status: "service_failed",
			serviceId: `service-${Date.now()}`,
			reason: errorMessage,
		}
		provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })
		return [false, `Failed to start service: ${errorMessage}`]
	}

	// Wait for service to be ready
	try {
		await waitForServiceReady(serviceHandle, readyTimeoutMs, healthCheckUrl)

		// Send service ready status
		const status: CommandExecutionStatus = {
			executionId,
			status: "service_ready",
			serviceId: serviceHandle.serviceId,
		}
		provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })

		// Return immediately, don't wait for process to end
		return [
			false,
			`Service started with ID: ${serviceHandle.serviceId}. Status: ${serviceHandle.status}. The service is running in the background.`,
		]
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		serviceHandle.status = "failed"
		ServiceManager.notifyStatusChange(serviceHandle)
		const status: CommandExecutionStatus = {
			executionId,
			status: "service_failed",
			serviceId: serviceHandle.serviceId,
			reason: errorMessage,
		}
		provider?.postMessageToWebview({ type: "commandExecutionStatus", text: JSON.stringify(status) })
		return [false, `Service failed to become ready: ${errorMessage}`]
	}
}

/**
 * Wait for service to be ready
 */
async function waitForServiceReady(
	serviceHandle: ServiceHandle,
	timeoutMs: number,
	healthCheckUrl?: string,
): Promise<void> {
	const startTime = Date.now()

	// If health check URL is already provided, use HTTP check
	if (healthCheckUrl) {
		return waitForHealthCheck(healthCheckUrl, timeoutMs)
	}

	// Otherwise wait for readyPattern to match
	if (serviceHandle.readyPattern) {
		return waitForPattern(serviceHandle, serviceHandle.readyPattern, timeoutMs)
	}

	// If no readiness detection, wait a short time then return directly
	await delay(2000)
}

/**
 * Wait for log pattern to match
 */
async function waitForPattern(
	serviceHandle: ServiceHandle,
	pattern: string | RegExp,
	timeoutMs: number,
): Promise<void> {
	const regex = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern
	const startTime = Date.now()

	return new Promise((resolve, reject) => {
		const checkInterval = setInterval(() => {
			// Check if latest logs match pattern
			const recentLogs = ServiceManager.getServiceLogs(serviceHandle.serviceId, 50)
			const allLogs = recentLogs.join("\n")

			if (regex.test(allLogs)) {
				serviceHandle.status = "ready"
				serviceHandle.readyAt = Date.now()
				ServiceManager.notifyStatusChange(serviceHandle)
				clearInterval(checkInterval)
				resolve()
				return
			}

			// Timeout check
			if (Date.now() - startTime > timeoutMs) {
				serviceHandle.status = "failed"
				ServiceManager.notifyStatusChange(serviceHandle)
				clearInterval(checkInterval)
				reject(new Error(`Service ready pattern not matched within ${timeoutMs}ms`))
			}
		}, 500) // Check every 500ms
	})
}

/**
 * Wait for HTTP health check to pass
 */
async function waitForHealthCheck(url: string, timeoutMs: number): Promise<void> {
	const startTime = Date.now()

	return new Promise((resolve, reject) => {
		const checkInterval = setInterval(async () => {
			try {
				const controller = new AbortController()
				const timeoutId = setTimeout(() => controller.abort(), 2000)

				const response = await fetch(url, {
					method: "GET",
					signal: controller.signal,
				})

				clearTimeout(timeoutId)

				if (response.ok) {
					clearInterval(checkInterval)
					resolve()
					return
				}
			} catch (error) {
				// Health check failed, continue waiting
			}

			// Timeout check
			if (Date.now() - startTime > timeoutMs) {
				clearInterval(checkInterval)
				reject(new Error(`Health check failed within ${timeoutMs}ms`))
			}
		}, 1000) // Check every 1 second
	})
}

export const executeCommandTool = new ExecuteCommandTool()
