import path from "path"
import { fileURLToPath } from "url"
import readline from "readline"

import { execa } from "execa"

export type StreamEvent = {
	type?: string
	subtype?: string
	requestId?: string
	command?: string
	content?: string
	code?: string
	success?: boolean
	done?: boolean
	id?: number
	queueDepth?: number
	queue?: Array<{ id?: string; text?: string; imageCount?: number; timestamp?: number }>
	tool_use?: {
		name?: string
		input?: Record<string, unknown>
	}
	tool_result?: {
		name?: string
		output?: string
	}
}

export type StreamCommand = {
	command: "start" | "message" | "cancel" | "ping" | "shutdown"
	requestId: string
	prompt?: string
	images?: string[]
}

export interface StreamCaseContext {
	readonly cliRoot: string
	readonly timeoutMs: number
	nextRequestId(prefix: string): string
	sendCommand(command: StreamCommand): void
}

export interface RunStreamCaseOptions {
	timeoutMs?: number
	onEvent: (event: StreamEvent, context: StreamCaseContext) => void
	onTimeoutMessage?: (context: StreamCaseContext) => string
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultCliRoot = path.resolve(__dirname, "../../..")

function parseEvent(line: string): StreamEvent | null {
	const trimmed = line.trim()

	if (!trimmed.startsWith("{")) {
		return null
	}

	try {
		return JSON.parse(trimmed) as StreamEvent
	} catch {
		return null
	}
}

export async function runStreamCase(options: RunStreamCaseOptions): Promise<void> {
	const cliRoot = process.env.JABBERWOCK_CLI_JABBERWOCKT
		? path.resolve(process.env.JABBERWOCK_CLI_JABBERWOCKT)
		: defaultCliRoot
	const timeoutMs = options.timeoutMs ?? 120_000

	const child = execa(
		"pnpm",
		["dev", "--print", "--stdin-prompt-stream", "--provider", "jabberwock", "--output-format", "stream-json"],
		{
			cwd: cliRoot,
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
			reject: false,
			forceKillAfterDelay: 2_000,
		},
	)

	child.stderr?.on("data", (chunk) => {
		process.stderr.write(chunk)
	})

	let requestCounter = 0

	const context: StreamCaseContext = {
		cliRoot,
		timeoutMs,
		nextRequestId(prefix: string): string {
			requestCounter += 1
			return `${prefix}-${Date.now()}-${requestCounter}`
		},
		sendCommand(command: StreamCommand): void {
			if (child.stdin?.destroyed) {
				return
			}

			child.stdin.write(`${JSON.stringify(command)}\n`)
		},
	}

	let handlerError: Error | null = null
	let timedOut = false

	const timeout = setTimeout(() => {
		timedOut = true
		const message = options.onTimeoutMessage?.(context) ?? "timed out waiting for stream scenario completion"
		handlerError = new Error(message)
		child.kill("SIGTERM")
	}, timeoutMs)

	const rl = readline.createInterface({
		input: child.stdout!,
		crlfDelay: Infinity,
	})

	rl.on("line", (line) => {
		process.stdout.write(`${line}\n`)

		const event = parseEvent(line)

		if (!event) {
			return
		}

		try {
			options.onEvent(event, context)
		} catch (error) {
			handlerError = error instanceof Error ? error : new Error(String(error))
			child.kill("SIGTERM")
		}
	})

	const result = await child
	clearTimeout(timeout)
	rl.close()

	if (handlerError) {
		throw handlerError
	}

	if (timedOut) {
		throw new Error("stream scenario timed out")
	}

	if (result.exitCode !== 0) {
		throw new Error(`CLI exited with non-zero code: ${result.exitCode}`)
	}
}
