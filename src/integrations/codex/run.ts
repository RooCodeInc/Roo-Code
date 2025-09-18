import * as vscode from "vscode"
import { execa } from "execa"
import readline from "readline"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { execFile } from "child_process"
import { randomUUID } from "crypto"

import type { ApiStreamChunk, ApiStreamUsageChunk } from "../../api/transform/stream"
import type { ReasoningEffortWithMinimal } from "@roo-code/types"

const workspaceRoot = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)

export interface CodexCliSessionOptions {
	cliPath?: string
	args?: string[]
	debugEnabled?: boolean
	debugLogPath?: string
	allowNetworkAccess?: boolean
}

export interface CodexTurnParams {
	text: string
	model: string
	approvalPolicy?: "never" | "on_request" | "on_failure" | "unless_trusted"
	allowNetwork?: boolean
	effort?: ReasoningEffortWithMinimal
}

interface CodexEvent {
	id: string
	msg: { type: string; [key: string]: any }
}

class AsyncQueue<T> implements AsyncIterable<T> {
	private buffer: T[] = []
	private waiters: Array<{ resolve: (value: IteratorResult<T>) => void; reject: (reason: any) => void }> = []
	private ended = false
	private storedError: any = null

	enqueue(value: T) {
		if (this.ended) return
		if (this.waiters.length > 0) {
			const waiter = this.waiters.shift()!
			waiter.resolve({ value, done: false })
			return
		}
		this.buffer.push(value)
	}

	close() {
		if (this.ended) return
		this.ended = true
		for (const waiter of this.waiters.splice(0)) {
			waiter.resolve({ value: undefined as any, done: true })
		}
	}

	error(err: any) {
		if (this.ended) return
		this.ended = true
		if (this.waiters.length > 0) {
			for (const waiter of this.waiters.splice(0)) {
				waiter.reject(err)
			}
		} else {
			this.storedError = err
		}
	}

	next(): Promise<IteratorResult<T>> {
		if (this.buffer.length > 0) {
			const value = this.buffer.shift()!
			return Promise.resolve({ value, done: false })
		}

		if (this.storedError) {
			const err = this.storedError
			this.storedError = null
			return Promise.reject(err)
		}

		if (this.ended) {
			return Promise.resolve({ value: undefined as any, done: true })
		}

		return new Promise<IteratorResult<T>>((resolve, reject) => {
			this.waiters.push({ resolve, reject })
		})
	}

	[Symbol.asyncIterator](): AsyncIterableIterator<T> {
		return {
			next: () => this.next(),
			[Symbol.asyncIterator]() {
				return this
			},
		} as AsyncIterableIterator<T>
	}
}

class Deferred<T> {
	promise: Promise<T>
	private resolveFn!: (value: T | PromiseLike<T>) => void
	private rejectFn!: (reason?: any) => void

	constructor() {
		this.promise = new Promise<T>((resolve, reject) => {
			this.resolveFn = resolve
			this.rejectFn = reject
		})
	}

	resolve(value: T) {
		this.resolveFn(value)
	}

	reject(reason: any) {
		this.rejectFn(reason)
	}
}

class CodexTurn {
	readonly id: string
	private queue = new AsyncQueue<ApiStreamChunk>()
	private completed = new Deferred<void>()
	private lastUsage: ApiStreamUsageChunk | undefined

	constructor(private logDebug: (line: string) => void) {
		this.id = `input-${randomUUID()}`
	}

	get done(): Promise<void> {
		return this.completed.promise
	}

	handleEvent(event: CodexEvent) {
		const { msg } = event
		switch (msg.type) {
			case "agent_message_delta": {
				const text = msg.delta ?? ""
				if (text) this.queue.enqueue({ type: "text", text })
				break
			}
			case "agent_message": {
				const text = msg.message ?? ""
				if (text) this.queue.enqueue({ type: "text", text })
				break
			}
			case "agent_reasoning_delta":
			case "agent_reasoning":
			case "agent_reasoning_raw_content_delta":
			case "agent_reasoning_raw_content": {
				const text = msg.delta ?? msg.text ?? ""
				if (text) this.queue.enqueue({ type: "reasoning", text })
				break
			}
			case "plan_update": {
				if (msg.summary) {
					this.queue.enqueue({ type: "reasoning", text: msg.summary })
				}
				break
			}
			case "token_count": {
				const info = msg.info
				if (info?.last_token_usage) {
					const last = info.last_token_usage
					this.lastUsage = {
						type: "usage",
						inputTokens: Number(last.input_tokens ?? 0),
						outputTokens: Number(last.output_tokens ?? 0),
						cacheReadTokens: Number(last.cached_input_tokens ?? 0) || 0,
						reasoningTokens: Number(last.reasoning_output_tokens ?? 0) || undefined,
					}
				}
				break
			}
			case "exec_command_output_delta": {
				const chunkBuffer = Array.isArray(msg.chunk)
					? Buffer.from(msg.chunk)
					: Buffer.from(msg.chunk ?? "", "base64")
				if (chunkBuffer.length > 0) {
					const text = chunkBuffer.toString("utf8")
					if (text) this.queue.enqueue({ type: "text", text })
				}
				break
			}
			case "exec_command_end": {
				const stdout = msg.stdout ?? ""
				const stderr = msg.stderr ?? ""
				const aggregated = msg.aggregated_output ?? ""
				const combined = [stdout, stderr, aggregated].filter(Boolean).join("\n").trim()
				if (combined) {
					this.queue.enqueue({ type: "text", text: combined })
				}
				break
			}
			case "background_event": {
				if (msg.message) {
					this.queue.enqueue({ type: "reasoning", text: msg.message })
				}
				break
			}
			case "stream_error": {
				if (msg.message) {
					this.queue.enqueue({ type: "reasoning", text: `[Codex] ${msg.message}` })
				}
				break
			}
			case "task_complete": {
				if (this.lastUsage) {
					this.queue.enqueue(this.lastUsage)
					this.lastUsage = undefined
				}
				this.queue.close()
				this.completed.resolve()
				break
			}
			case "error": {
				const message = msg.message || "Codex CLI returned an error"
				this.fail(new Error(message))
				break
			}
			default: {
				this.logDebug(`Unhandled Codex event type: ${msg.type}`)
			}
		}
	}

	flushRemainingUsage() {
		if (this.lastUsage) {
			this.queue.enqueue(this.lastUsage)
			this.lastUsage = undefined
		}
	}

	fail(error: Error) {
		this.queue.error(error)
		try {
			this.completed.reject(error)
		} catch {}
	}

	stream(): AsyncGenerator<ApiStreamChunk> {
		const iterator = this.queue[Symbol.asyncIterator]()
		const finalize = () => {
			this.flushRemainingUsage()
		}

		return (async function* (self: CodexTurn) {
			try {
				while (true) {
					const { value, done } = await iterator.next()
					if (done) break
					yield value
				}
			} finally {
				finalize()
			}
		})(this)
	}
}

export class CodexCliSession {
	private child!: ReturnType<typeof execa>
	private rl!: readline.Interface
	private readonly debugEnabled: boolean
	private readonly debugLogPath: string
	private readonly allowNetwork: boolean
	private readonly args: string[]
	private readonly logFileStream?: fs.WriteStream
	private readonly turns = new Map<string, CodexTurn>()
	private currentTurn: CodexTurn | null = null
	private readyDeferred = new Deferred<void>()
	private closed = false

	private constructor(private readonly options: CodexCliSessionOptions & { resolvedCliPath: string }) {
		this.debugEnabled = !!options.debugEnabled
		this.debugLogPath = options.debugLogPath || path.join(os.tmpdir(), "roo-codex-debug.log")
		this.allowNetwork = options.allowNetworkAccess ?? true
		if (options.args && options.args.length > 0) {
			this.args = options.args
		} else {
			const timeoutArg = process.env.CODEX_RTC_TIMEOUT ?? process.env.ROO_CODEX_RTC_TIMEOUT
			const baseArgs = ["proto"]
			this.args = timeoutArg ? [...baseArgs, "--rtc-timeout", timeoutArg] : baseArgs
		}

		if (this.debugEnabled) {
			this.ensureDebugLogDir()
			this.logFileStream = fs.createWriteStream(this.debugLogPath, { flags: "a" })
		}
	}

/**
 * Creates a new Codex CLI session for interactive communication
 * @param options - Configuration options for the CLI session
 * @param options.cliPath - Optional custom path to the Codex CLI binary
 * @param options.args - Optional CLI arguments to pass
 * @param options.debugEnabled - Enable debug logging
 * @param options.debugLogPath - Custom path for debug logs
 * @param options.allowNetworkAccess - Allow network access in the session
 * @returns Promise resolving to an initialized CodexCliSession
 * @throws Error if Codex CLI is not found or fails to initialize
 */
static async create(options: CodexCliSessionOptions): Promise<CodexCliSession> {
		const resolvedCliPath = await resolveCodexCliPath(options.cliPath)
		if (!resolvedCliPath) {
			throw new Error("Codex CLI not found. Please install @openai/codex or specify codexCliPath in settings.")
		}

		const session = new CodexCliSession({ ...options, resolvedCliPath })
		session.start()
		await session.readyDeferred.promise
		return session
	}

	private ensureDebugLogDir() {
		try {
			const dir = path.dirname(this.debugLogPath)
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true })
			}
		} catch (error) {
			console.warn("Failed to prepare Codex debug log directory:", error)
		}
	}

	private logDebug(line: string) {
		if (!this.debugEnabled) return
		const timestamped = `[${new Date().toISOString()}] ${line}`
		if (this.logFileStream) {
if (this.logFileStream) {
    try {
        this.logFileStream.write(`${timestamped}${os.EOL}`)
    } catch (error) {
        console.warn("Failed to write to Codex debug log stream:", error)
    }
}
		} else {
			try {
				fs.appendFileSync(this.debugLogPath, `${timestamped}${os.EOL}`)
			} catch (error) {
				console.warn("Failed to append Codex debug log:", error)
			}
		}
	}

	private start() {
		const { resolvedCliPath } = this.options
		this.child = execa(resolvedCliPath, this.args, {
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
			cwd: workspaceRoot,
			env: { ...process.env },
			maxBuffer: 1024 * 1024 * 1000,
		})

		this.child.stderr?.on("data", (buf: Buffer) => this.logDebug(`stderr: ${buf?.toString?.() || buf}`))
		this.child.on("error", (error: Error) => this.onProcessError(error))
		this.child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => this.onProcessExit(code, signal))

		this.rl = readline.createInterface({ input: this.child.stdout! })
		this.rl.on("line", (line: string) => this.handleLine(line))
	}

	private onProcessError(error: Error) {
		if (!this.closed) {
			this.readyDeferred.reject(error)
		}
		this.failAllTurns(error)
	}

	private onProcessExit(code: number | null, signal: NodeJS.Signals | null) {
		this.closed = true
		const message = signal ? `Codex CLI exited due to signal ${signal}` : `Codex CLI exited with code ${code}`
		const error = new Error(message)
		if (this.readyDeferred) {
			this.readyDeferred.reject(error)
		}
		this.failAllTurns(error)
		this.disposeResources()
	}

	private disposeResources() {
		try {
			this.rl?.close()
		} catch {}
		try {
			this.child?.stdin?.end()
		} catch {}
		try {
			this.logFileStream?.end()
		} catch {}
	}

	private failAllTurns(error: Error) {
		for (const turn of this.turns.values()) {
			turn.fail(error)
		}
		if (this.currentTurn) {
			this.currentTurn.fail(error)
		}
		this.turns.clear()
		this.currentTurn = null
	}

	private handleLine(line: string) {
		const trimmed = line.trim()
		if (!trimmed) return

		let event: CodexEvent | undefined
		try {
			event = JSON.parse(trimmed) as CodexEvent
		} catch (error) {
			this.logDebug(`Failed to parse Codex event: ${(error as Error).message}`)
			return
		}

		if (event.msg?.type === "session_configured") {
			this.readyDeferred.resolve()
			return
		}

		const turn = this.turns.get(event.id) ?? this.currentTurn
		if (turn) {
			turn.handleEvent(event)
		} else {
			this.logDebug(`Dropping Codex event without matching turn: ${event.msg?.type}`)
		}
	}

	private writeSubmission(submission: any) {
		if (this.closed) {
			throw new Error("Codex CLI session is closed")
		}
		const payload = JSON.stringify(submission)
		this.logDebug(`submit ${payload}`)
		this.child.stdin?.write(`${payload}\n`)
	}

	async runTurn(params: CodexTurnParams): Promise<AsyncGenerator<ApiStreamChunk>> {
		if (this.closed) {
			throw new Error("Codex CLI session has terminated")
		}

		await this.readyDeferred.promise

		if (this.currentTurn) {
			await this.currentTurn.done.catch(() => undefined)
			this.currentTurn = null
		}

		const turn = new CodexTurn((line) => this.logDebug(line))
		this.turns.set(turn.id, turn)
		this.currentTurn = turn

		const overrideOp: any = {
			type: "override_turn_context",
			model: params.model,
			approval_policy: params.approvalPolicy ?? "never",
			sandbox_policy: {
				mode: "workspace-write",
				network_access: params.allowNetwork ?? this.allowNetwork,
			},
		}
		if (params.effort) {
			overrideOp.effort = params.effort
		}
		const overrideSubmission = {
			id: `override-${randomUUID()}`,
			op: overrideOp,
		}

		this.writeSubmission(overrideSubmission)

		const userSubmission = {
			id: turn.id,
			op: {
				type: "user_input",
				items: [{ type: "text", text: params.text }],
			},
		}

		this.writeSubmission(userSubmission)

		const stream = turn.stream()

		const finalizeTurn = () => {
			this.turns.delete(turn.id)
			if (this.currentTurn === turn) {
				this.currentTurn = null
			}
		}

		return (async function* (
			self: CodexCliSession,
			generator: AsyncGenerator<ApiStreamChunk>,
			currentTurn: CodexTurn,
		) {
			try {
				for await (const chunk of generator) {
					yield chunk
				}
			} finally {
				finalizeTurn()
			}
		})(this, stream, turn)
	}

	async shutdown(): Promise<void> {
		if (this.closed) return
		try {
			this.writeSubmission({ id: `shutdown-${randomUUID()}`, op: { type: "shutdown" } })
		} catch {}
		try {
			await this.child
		} catch {}
		this.closed = true
		this.disposeResources()
	}
}

export async function resolveCodexCliPath(configuredPath?: string): Promise<string | undefined> {
	const expanded = expandHome(configuredPath)
	if (expanded && fs.existsSync(expanded)) {
		return expanded
	}

	return new Promise<string | undefined>((resolve) => {
		const isWin = process.platform === "win32"
		const cmd = isWin ? "where" : "which"
		execFile(cmd, ["codex"], (err, stdout) => {
			if (err || !stdout) {
				resolve(undefined)
				return
			}
			const firstLine = stdout.toString().trim().split(/\r?\n/)[0]
			resolve(firstLine || undefined)
		})
	})
}

export async function checkCodexLoginStatus(
	cliPath?: string,
): Promise<{ status: "ok" | "not_found"; auth?: boolean; message?: string; cliPath?: string }> {
	const resolved = await resolveCodexCliPath(cliPath)
	if (!resolved) {
		return { status: "not_found", auth: false, message: "Codex CLI not found" }
	}

	return new Promise((resolve) => {
		execFile(resolved, ["login", "status"], { cwd: workspaceRoot }, (err, _stdout, stderr) => {
			const message = stderr?.toString()?.trim() || _stdout?.toString()?.trim()
			if (err) {
				resolve({ status: "not_found", auth: false, message, cliPath: resolved })
			} else {
				const loggedIn = message?.toLowerCase().includes("logged in") ?? false
				resolve({ status: "ok", auth: loggedIn, message, cliPath: resolved })
			}
		})
	})
}

function expandHome(input?: string): string | undefined {
	if (!input) return undefined
	if (!input.startsWith("~")) return input
	return path.join(os.homedir(), input.slice(1))
}
