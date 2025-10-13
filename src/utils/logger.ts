import * as vscode from "vscode"
import { inspect } from "util"
import { Package } from "../shared/package"

/**
 * Log levels (smaller value indicates lower priority)
 */
export enum LogLevel {
	Debug = 0,
	Info = 1,
	Warn = 2,
	Error = 3,
	Off = 4,
}

export interface LoggerOptions {
	/** Minimum output level (default: Debug) */
	level?: LogLevel
	/** Whether to enable logging (default: true) */
	enabled?: boolean
	/** Custom timestamp function (default: ISO8601 string) */
	timeFn?: () => string
	/** Inject and reuse if OutputChannel is already created externally */
	channel?: vscode.OutputChannel
}

/**
 * Injectable / replaceable logger interface for easy unit test mocking
 */
export interface ILogger {
	debug(message: unknown, ...args: unknown[]): void
	info(message: unknown, ...args: unknown[]): void
	warn(message: unknown, ...args: unknown[]): void
	error(message: unknown, ...args: unknown[]): void
	dispose(): void
}

/**
 * Global cache to ensure loggers with the same name reuse the same instance,
 * preventing state fragmentation caused by multiple creations.
 */
const loggerRegistry = new Map<string, ChannelLogger>()
let _channelPannel: vscode.OutputChannel | undefined
/**
 * Factory function: Get (or create) VS Code Logger instance.
 * Always returns the same instance for loggers with the same name.
 */
export function createLogger(name: string = Package.outputChannel, options: LoggerOptions = {}): ChannelLogger {
	const cached = loggerRegistry.get(name)
	if (cached) return cached

	const logger = new ChannelLogger(name, options)
	loggerRegistry.set(name, logger)
	return logger
}

/**
 * Destroy all registered logger instances uniformly
 * Usually called when extension is deactivated
 */
export function deactivate(): void {
	for (const logger of loggerRegistry.values()) {
		logger.dispose()
	}
	loggerRegistry.clear()
}

/* ----------------------- VS Code Implementation ----------------------- */

class ChannelLogger implements ILogger {
	private static readonly MAX_BUFFER_SIZE = 1000
	readonly channel: vscode.OutputChannel
	private readonly buffer: string[] = []
	private flushHandle: NodeJS.Immediate | null = null
	private readonly level: LogLevel
	private readonly enabled: boolean
	private readonly timeFn: () => string

	constructor(
		private readonly name: string,
		opts: LoggerOptions,
	) {
		// Reuse externally injected OutputChannel; create one if not provided
		this.channel = opts.channel ?? vscode.window.createOutputChannel(name)
		this.level = opts.level ?? LogLevel.Debug
		this.enabled = opts.enabled ?? true
		this.timeFn = opts.timeFn ?? (() => new Date().toLocaleString())
	}

	// ---------- ILogger Implementation ----------

	debug(msg: unknown, ...args: unknown[]): void {
		this.log(LogLevel.Debug, "DEBUG", msg, ...args)
	}
	info(msg: unknown, ...args: unknown[]): void {
		this.log(LogLevel.Info, "INFO", msg, ...args)
	}
	warn(msg: unknown, ...args: unknown[]): void {
		this.log(LogLevel.Warn, "WARN", msg, ...args)
	}
	error(msg: unknown, ...args: unknown[]): void {
		this.log(LogLevel.Error, "ERROR", msg, ...args)
	}

	dispose(): void {
		this.flush() // Ensure remaining logs are written
		this.channel.dispose()
		if (this.flushHandle) {
			clearImmediate(this.flushHandle)
		}

		// Remove from cache to prevent memory leak
		loggerRegistry.delete(this.name)
	}

	// ---------- Internal Helpers ----------

	private log(level: LogLevel, tag: string, msg: unknown, ...args: unknown[]): void {
		if (!this.enabled || level < this.level) return

		// Buffer size check
		if (this.buffer.length >= ChannelLogger.MAX_BUFFER_SIZE) {
			this.flush() // Force flush
		}

		const line = `[${this.timeFn()}] [${tag}] ` + [msg, ...args].map(this.safeToString).join(" ")

		this.buffer.push(line)
		this.scheduleFlush()
	}

	/**
	 * Use setImmediate to batch flush during event loop idle time to reduce UI overhead
	 */
	private scheduleFlush(): void {
		if (this.flushHandle) return
		this.flushHandle = setImmediate(() => {
			this.flush()
			this.flushHandle = null
		})
	}

	private flush(): void {
		if (this.buffer.length === 0) return
		for (const line of this.buffer) {
			this.channel.appendLine(line)
		}
		this.buffer.length = 0
	}

	private safeToString(value: unknown): string {
		if (typeof value === "string") return value
		try {
			// Use util.inspect to provide more friendly object display
			return inspect(value, {
				colors: false,
				depth: 3,
				maxArrayLength: 10,
				maxStringLength: 200,
				breakLength: Infinity,
				compact: true,
			})
		} catch (_) {
			return String(value)
		}
	}
}
