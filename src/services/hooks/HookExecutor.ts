/**
 * Hook Executor
 *
 * Executes shell commands for hooks with:
 * - JSON context passed via stdin
 * - Environment variables set per PRD
 * - Timeout handling
 * - Exit code interpretation (0=success, 2=block, other=error)
 * - stdout/stderr capture
 */

import { spawn, ChildProcess } from "child_process"
import * as os from "os"
import * as path from "path"
import {
	ResolvedHook,
	HookContext,
	HookExecutionResult,
	HookExitCode,
	HookModificationSchema,
	HookModification,
	isBlockingEvent,
	ConversationHistoryEntry,
} from "./types"

/**
 * Default timeout in seconds.
 */
const DEFAULT_TIMEOUT = 60

/**
 * Get the default shell based on platform.
 * Windows: PowerShell
 * Unix: User's shell from SHELL env var, or /bin/sh
 */
function getDefaultShell(): { shell: string; shellArgs: string[] } {
	if (os.platform() === "win32") {
		return {
			shell: "powershell.exe",
			shellArgs: ["-NoProfile", "-NonInteractive", "-Command"],
		}
	}

	// Unix: try user's shell, fall back to /bin/sh
	const userShell = process.env.SHELL || "/bin/sh"
	return {
		shell: userShell,
		shellArgs: ["-c"],
	}
}

/**
 * Parse a custom shell specification.
 * Supports "bash", "/bin/bash", "powershell.exe", etc.
 */
function parseShellSpec(shellSpec: string): { shell: string; shellArgs: string[] } {
	const lower = shellSpec.toLowerCase()

	// Handle PowerShell variants
	if (lower.includes("powershell") || lower.includes("pwsh")) {
		return {
			shell: shellSpec,
			shellArgs: ["-NoProfile", "-NonInteractive", "-Command"],
		}
	}

	// All other shells use -c
	return {
		shell: shellSpec,
		shellArgs: ["-c"],
	}
}

/**
 * Build environment variables for hook execution.
 */
function buildEnvVars(hook: ResolvedHook, context: HookContext): NodeJS.ProcessEnv {
	const baseEnv = { ...process.env }

	return {
		...baseEnv,
		ROO_PROJECT_DIR: context.project.directory,
		ROO_TASK_ID: context.session.taskId,
		ROO_SESSION_ID: context.session.sessionId,
		ROO_MODE: context.session.mode,
		ROO_TOOL_NAME: context.tool?.name || "",
		ROO_EVENT: context.event,
		ROO_HOOK_ID: hook.id,
	}
}

/**
 * Build the stdin JSON payload for a hook.
 */
function buildStdinPayload(
	hook: ResolvedHook,
	context: HookContext,
	conversationHistory?: ConversationHistoryEntry[],
): string {
	// Start with the base context
	const payload: HookContext = { ...context }

	// Only include conversation history if the hook opts in
	if (hook.includeConversationHistory && conversationHistory) {
		payload.conversationHistory = conversationHistory
	}

	return JSON.stringify(payload)
}

/**
 * Try to parse stdout as a modification response.
 * Returns undefined if stdout is empty or not valid modification JSON.
 */
function parseModificationResponse(stdout: string, hook: ResolvedHook): HookModification | undefined {
	if (!stdout.trim()) {
		return undefined
	}

	try {
		const parsed = JSON.parse(stdout)
		const result = HookModificationSchema.safeParse(parsed)

		if (result.success) {
			// Only PreToolUse hooks can modify input
			if (hook.event !== "PreToolUse") {
				console.warn(`Hook "${hook.id}" returned modification but is not a PreToolUse hook - ignoring`)
				return undefined
			}
			return result.data
		}

		// Not a valid modification response - that's fine, hooks don't have to return JSON
		return undefined
	} catch {
		// Not valid JSON - that's fine
		return undefined
	}
}

/**
 * Execute a single hook command.
 *
 * @param hook - The hook to execute
 * @param context - The hook context
 * @param conversationHistory - Optional conversation history (only included if hook opts in)
 * @returns Execution result
 */
export async function executeHook(
	hook: ResolvedHook,
	context: HookContext,
	conversationHistory?: ConversationHistoryEntry[],
): Promise<HookExecutionResult> {
	const startTime = Date.now()
	const timeout = (hook.timeout || DEFAULT_TIMEOUT) * 1000 // Convert to ms

	// Determine shell
	const shellConfig = hook.shell ? parseShellSpec(hook.shell) : getDefaultShell()

	// Build environment and stdin
	const env = buildEnvVars(hook, context)
	const stdin = buildStdinPayload(hook, context, conversationHistory)

	return new Promise<HookExecutionResult>((resolve) => {
		let child: ChildProcess | null = null
		let stdout = ""
		let stderr = ""
		let timedOut = false
		let resolved = false

		const finalize = (exitCode: number | null, error?: Error) => {
			if (resolved) return
			resolved = true

			const duration = Date.now() - startTime

			// Try to parse modification from stdout
			const modification = parseModificationResponse(stdout, hook)

			resolve({
				hook,
				exitCode,
				stdout,
				stderr,
				duration,
				timedOut,
				error,
				modification,
			})
		}

		// Set up timeout
		const timeoutHandle = setTimeout(() => {
			timedOut = true
			if (child) {
				// Try graceful kill first (SIGTERM), then force (SIGKILL)
				child.kill("SIGTERM")
				setTimeout(() => {
					if (child && !child.killed) {
						child.kill("SIGKILL")
					}
				}, 1000)
			}
		}, timeout)

		try {
			// Spawn the shell process
			child = spawn(shellConfig.shell, [...shellConfig.shellArgs, hook.command], {
				cwd: context.project.directory,
				env,
				stdio: ["pipe", "pipe", "pipe"],
				// Don't throw on Windows if shell not found
				windowsHide: true,
			})

			// Write stdin
			if (child.stdin) {
				child.stdin.write(stdin)
				child.stdin.end()
			}

			// Capture stdout
			if (child.stdout) {
				child.stdout.on("data", (data: Buffer) => {
					stdout += data.toString()
				})
			}

			// Capture stderr
			if (child.stderr) {
				child.stderr.on("data", (data: Buffer) => {
					stderr += data.toString()
				})
			}

			// Handle process exit
			child.on("close", (code) => {
				clearTimeout(timeoutHandle)
				finalize(code)
			})

			// Handle spawn errors
			child.on("error", (err) => {
				clearTimeout(timeoutHandle)
				finalize(null, err)
			})
		} catch (err) {
			clearTimeout(timeoutHandle)
			finalize(null, err instanceof Error ? err : new Error(String(err)))
		}
	})
}

/**
 * Interpret the result of a hook execution.
 *
 * @param result - The execution result
 * @returns Object with interpretation flags
 */
export function interpretResult(result: HookExecutionResult): {
	success: boolean
	blocked: boolean
	blockMessage: string | undefined
	shouldContinue: boolean
} {
	// Check for execution errors first
	if (result.error || result.exitCode === null) {
		return {
			success: false,
			blocked: false,
			blockMessage: undefined,
			shouldContinue: true, // Execution errors don't block, per PRD
		}
	}

	// Check for timeout
	if (result.timedOut) {
		return {
			success: false,
			blocked: false,
			blockMessage: undefined,
			shouldContinue: true, // Timeouts don't block, per PRD
		}
	}

	// Exit code 0 = success
	if (result.exitCode === HookExitCode.Success) {
		return {
			success: true,
			blocked: false,
			blockMessage: undefined,
			shouldContinue: true,
		}
	}

	// Exit code 2 = block (only for blocking events)
	if (result.exitCode === HookExitCode.Block) {
		if (isBlockingEvent(result.hook.event)) {
			return {
				success: false,
				blocked: true,
				blockMessage: result.stderr.trim() || `Hook "${result.hook.id}" blocked execution`,
				shouldContinue: false,
			}
		} else {
			// Non-blocking event with exit code 2 is treated as regular failure
			console.warn(
				`Hook "${result.hook.id}" returned exit code 2 (block) but ${result.hook.event} is not a blocking event - treating as error`,
			)
			return {
				success: false,
				blocked: false,
				blockMessage: undefined,
				shouldContinue: true,
			}
		}
	}

	// Other non-zero exit codes = error, but don't block
	return {
		success: false,
		blocked: false,
		blockMessage: undefined,
		shouldContinue: true,
	}
}

/**
 * Get a human-readable description of a hook result for logging.
 */
export function describeResult(result: HookExecutionResult): string {
	const hook = result.hook

	if (result.error) {
		return `Hook "${hook.id}" failed to execute: ${result.error.message}`
	}

	if (result.timedOut) {
		return `Hook "${hook.id}" timed out after ${hook.timeout || DEFAULT_TIMEOUT}s`
	}

	if (result.exitCode === HookExitCode.Success) {
		return `Hook "${hook.id}" completed successfully in ${result.duration}ms`
	}

	if (result.exitCode === HookExitCode.Block) {
		return `Hook "${hook.id}" blocked with: ${result.stderr.trim() || "(no message)"}`
	}

	return `Hook "${hook.id}" returned exit code ${result.exitCode} in ${result.duration}ms`
}
