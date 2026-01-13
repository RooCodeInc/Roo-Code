/**
 * ACP Logger
 *
 * Provides file-based logging for ACP debugging.
 * Logs are written to ~/.roo/acp.log by default.
 *
 * Since ACP uses stdin/stdout for protocol communication,
 * we cannot use console.log for debugging. This logger writes
 * to a file instead.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"

import type { IAcpLogger } from "./interfaces.js"

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_LOG_DIR = path.join(os.homedir(), ".roo")
const DEFAULT_LOG_FILE = "acp.log"
const MAX_LOG_SIZE = 10 * 1024 * 1024 // 10MB

// =============================================================================
// Logger Class
// =============================================================================

class AcpLogger implements IAcpLogger {
	private logPath: string
	private enabled: boolean = true
	private stream: fs.WriteStream | null = null

	constructor() {
		const logDir = process.env.ROO_ACP_LOG_DIR || DEFAULT_LOG_DIR
		const logFile = process.env.ROO_ACP_LOG_FILE || DEFAULT_LOG_FILE
		this.logPath = path.join(logDir, logFile)

		// Disable logging if explicitly set to false
		if (process.env.ROO_ACP_LOG === "false") {
			this.enabled = false
		}
	}

	/**
	 * Initialize the logger.
	 * Creates the log directory if it doesn't exist.
	 */
	private ensureLogFile(): void {
		if (!this.enabled) return

		try {
			const logDir = path.dirname(this.logPath)
			if (!fs.existsSync(logDir)) {
				fs.mkdirSync(logDir, { recursive: true })
			}

			// Rotate log if too large
			if (fs.existsSync(this.logPath)) {
				const stats = fs.statSync(this.logPath)
				if (stats.size > MAX_LOG_SIZE) {
					const rotatedPath = `${this.logPath}.1`
					if (fs.existsSync(rotatedPath)) {
						fs.unlinkSync(rotatedPath)
					}
					fs.renameSync(this.logPath, rotatedPath)
				}
			}

			// Open stream if not already open
			if (!this.stream) {
				this.stream = fs.createWriteStream(this.logPath, { flags: "a" })
			}
		} catch (_error) {
			// Silently disable logging on error
			this.enabled = false
		}
	}

	/**
	 * Format a log message with timestamp and level.
	 */
	private formatMessage(level: string, component: string, message: string, data?: unknown): string {
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

		return formatted + "\n"
	}

	/**
	 * Write a log entry.
	 */
	private write(level: string, component: string, message: string, data?: unknown): void {
		if (!this.enabled) return

		this.ensureLogFile()

		if (this.stream) {
			const formatted = this.formatMessage(level, component, message, data)
			this.stream.write(formatted)
		}
	}

	/**
	 * Log an info message.
	 */
	info(component: string, message: string, data?: unknown): void {
		this.write("INFO", component, message, data)
	}

	/**
	 * Log a debug message.
	 */
	debug(component: string, message: string, data?: unknown): void {
		this.write("DEBUG", component, message, data)
	}

	/**
	 * Log a warning message.
	 */
	warn(component: string, message: string, data?: unknown): void {
		this.write("WARN", component, message, data)
	}

	/**
	 * Log an error message.
	 */
	error(component: string, message: string, data?: unknown): void {
		this.write("ERROR", component, message, data)
	}

	/**
	 * Log an incoming request.
	 */
	request(method: string, params?: unknown): void {
		this.write("REQUEST", "ACP", `→ ${method}`, params)
	}

	/**
	 * Log an outgoing response.
	 */
	response(method: string, result?: unknown): void {
		this.write("RESPONSE", "ACP", `← ${method}`, result)
	}

	/**
	 * Log an outgoing notification.
	 */
	notification(method: string, params?: unknown): void {
		this.write("NOTIFY", "ACP", `→ ${method}`, params)
	}

	/**
	 * Get the log file path.
	 */
	getLogPath(): string {
		return this.logPath
	}

	/**
	 * Close the logger.
	 */
	close(): void {
		if (this.stream) {
			this.stream.end()
			this.stream = null
		}
	}
}

// =============================================================================
// Singleton Export
// =============================================================================

export const acpLog = new AcpLogger()

// Log startup
acpLog.info("Logger", `ACP logging initialized. Log file: ${acpLog.getLogPath()}`)
