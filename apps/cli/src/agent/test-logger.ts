/**
 * Test Logger for CLI/ACP Cancellation Debugging
 *
 * This writes logs to ~/.roo/cli-acp-test.log for comparing CLI
 * behavior with ACP during cancellation testing.
 *
 * Format matches ACP logger for easy side-by-side comparison.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"

const LOG_DIR = path.join(os.homedir(), ".roo")
const LOG_FILE = path.join(LOG_DIR, "cli-acp-test.log")

let stream: fs.WriteStream | null = null

/**
 * Ensure log file and directory exist.
 */
function ensureLogFile(): void {
	try {
		if (!fs.existsSync(LOG_DIR)) {
			fs.mkdirSync(LOG_DIR, { recursive: true })
		}
		if (!stream) {
			stream = fs.createWriteStream(LOG_FILE, { flags: "a" })
		}
	} catch {
		// Silently fail
	}
}

/**
 * Format and write a log entry.
 */
function write(level: string, component: string, message: string, data?: unknown): void {
	ensureLogFile()
	if (!stream) return

	const timestamp = new Date().toISOString()
	let formatted = `[${timestamp}] [${level}] [${component}] ${message}`

	if (data !== undefined) {
		try {
			const dataStr = JSON.stringify(data, null, 2)
			formatted += `\n${dataStr}`
		} catch {
			formatted += ` [Data: unserializable]`
		}
	}

	stream.write(formatted + "\n")
}

/**
 * Test logger for CLI cancellation debugging.
 *
 * Usage:
 *   testLog.info("ExtensionClient", "STATE: idle → running (running=true, streaming=true, ask=none)")
 *   testLog.info("Session", "CANCEL: triggered")
 */
export const testLog = {
	info(component: string, message: string, data?: unknown): void {
		write("INFO", component, message, data)
	},

	debug(component: string, message: string, data?: unknown): void {
		write("DEBUG", component, message, data)
	},

	warn(component: string, message: string, data?: unknown): void {
		write("WARN", component, message, data)
	},

	error(component: string, message: string, data?: unknown): void {
		write("ERROR", component, message, data)
	},

	/**
	 * Clear the log file (call at start of test session).
	 */
	clear(): void {
		try {
			if (stream) {
				stream.end()
				stream = null
			}
			fs.writeFileSync(LOG_FILE, "")
		} catch {
			// Silently fail
		}
	},

	/**
	 * Get the log file path.
	 */
	getLogPath(): string {
		return LOG_FILE
	},

	/**
	 * Close the logger.
	 */
	close(): void {
		if (stream) {
			stream.end()
			stream = null
		}
	},
}

// Log startup
testLog.info("TestLogger", `CLI test logging initialized. Log file: ${LOG_FILE}`)
