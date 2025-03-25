// streamUtils/pwshStream.ts
import { execSync } from "child_process"
import { CommandStream } from "./index"

/**
 * Creates a stream with real command output using PowerShell Core
 * @param command The PowerShell command to execute
 * @returns An object containing the stream and exit code
 */
export function createPowerShellStream(command: string): CommandStream {
	let realOutput: string
	let exitCode: number

	try {
		// Execute the PowerShell command directly
		// Use single quotes for the Command parameter to preserve PowerShell variables
		// Escape any single quotes in the command
		const escapedCommand = command.replace(/'/g, "'\\''")
		const shellCommand = `pwsh -NoProfile -NonInteractive -Command '${escapedCommand}'`

		realOutput = execSync(shellCommand, {
			encoding: "utf8",
			maxBuffer: 100 * 1024 * 1024,
			stdio: ["pipe", "pipe", "pipe"], // Capture stderr for debugging
		})
		exitCode = 0 // Command succeeded
	} catch (error: any) {
		// Command failed - get output and exit code from error
		realOutput = error.stdout?.toString() || ""
		console.error(`PowerShell command failed with status ${error.status || "unknown"}:`, error.message)
		if (error.stderr) {
			console.error(`stderr: ${error.stderr.toString()}`)
		}
		exitCode = error.status || 1
	}

	// Create an async iterator for the stream
	const stream = {
		async *[Symbol.asyncIterator]() {
			// Command start marker
			yield "\x1b]633;C\x07"

			// Normalize line endings to ensure consistent behavior across platforms
			if (realOutput.length > 0) {
				yield realOutput.replace(/\r\n/g, "\n")
			}

			// Command end marker
			yield "\x1b]633;D\x07"
		},
	}

	return { stream, exitCode }
}
