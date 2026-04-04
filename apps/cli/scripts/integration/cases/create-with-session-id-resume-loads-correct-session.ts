import fs from "fs/promises"
import os from "os"
import path from "path"
import readline from "readline"
import { fileURLToPath } from "url"
import { randomUUID } from "crypto"

import { execa } from "execa"
import type { TaskSessionEntry } from "@jabberwock/core/cli"

type StreamEvent = {
	type?: string
	subtype?: string
	requestId?: string
	command?: string
	taskId?: string
	content?: string
	code?: string
	success?: boolean
	done?: boolean
}

const RESUME_TIMEOUT_MS = 180_000
const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseStreamEvent(line: string): StreamEvent | null {
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

async function listSessions(cliRoot: string, workspacePath: string): Promise<TaskSessionEntry[]> {
	const result = await execa("pnpm", ["dev", "list", "sessions", "--workspace", workspacePath, "--format", "json"], {
		cwd: cliRoot,
		reject: false,
	})

	if (result.exitCode !== 0) {
		throw new Error(`list sessions failed with exit code ${result.exitCode}: ${result.stderr || result.stdout}`)
	}

	const stdoutLines = result.stdout.split("\n")
	const jsonStartIndex = stdoutLines.findIndex((line) => line.trim().startsWith("{"))
	if (jsonStartIndex === -1) {
		throw new Error(`list sessions output did not contain JSON payload: ${result.stdout}`)
	}

	const jsonPayload = stdoutLines.slice(jsonStartIndex).join("\n").trim()

	let parsed: unknown
	try {
		parsed = JSON.parse(jsonPayload)
	} catch (error) {
		throw new Error(
			`failed to parse list sessions output as JSON: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	if (
		typeof parsed !== "object" ||
		parsed === null ||
		!("sessions" in parsed) ||
		!Array.isArray((parsed as { sessions?: unknown }).sessions)
	) {
		throw new Error("list sessions output missing sessions array")
	}

	return (parsed as { sessions: TaskSessionEntry[] }).sessions
}

async function createSessionWithCustomId(
	cliRoot: string,
	workspacePath: string,
	sessionId: string,
	prompt: string,
): Promise<void> {
	const result = await execa(
		"pnpm",
		[
			"dev",
			"--print",
			"--provider",
			"jabberwock",
			"--output-format",
			"stream-json",
			"--workspace",
			workspacePath,
			"--create-with-session-id",
			sessionId,
			prompt,
		],
		{
			cwd: cliRoot,
			reject: false,
		},
	)

	if (result.exitCode !== 0) {
		throw new Error(
			`create-with-session-id failed for ${sessionId} with exit code ${result.exitCode}: ${result.stderr || result.stdout}`,
		)
	}

	const lines = result.stdout.split("\n")
	const events = lines.map(parseStreamEvent).filter((event): event is StreamEvent => Boolean(event))
	const errorEvent = events.find((event) => event.type === "error")

	if (errorEvent) {
		throw new Error(
			`create-with-session-id emitted error for ${sessionId}: code=${errorEvent.code ?? "none"} content=${errorEvent.content ?? ""}`,
		)
	}

	const completion = events.find((event) => event.type === "result" && event.done === true)
	if (!completion) {
		throw new Error(`create-with-session-id did not emit final result for ${sessionId}`)
	}

	if (completion.success !== true) {
		throw new Error(`create-with-session-id completed unsuccessfully for ${sessionId}`)
	}
}

async function resumeSessionAndSendMarker(
	cliRoot: string,
	workspacePath: string,
	sessionId: string,
	messageToken: string,
): Promise<void> {
	const pingRequestId = `ping-${Date.now()}`
	const messageRequestId = `message-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`

	const messagePrompt = `Resume marker token: ${messageToken}. Reply with exactly "ack-${messageToken}".`

	const child = execa(
		"pnpm",
		[
			"dev",
			"--print",
			"--stdin-prompt-stream",
			"--provider",
			"jabberwock",
			"--output-format",
			"stream-json",
			"--workspace",
			workspacePath,
			"--session-id",
			sessionId,
		],
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

	let pingSent = false
	let messageSent = false
	let shutdownSent = false
	let sawMessageControlDone = false
	let sawUserTurnWithMarker = false
	let shutdownTaskId: string | undefined
	let handlerError: Error | null = null
	let timedOut = false

	const sendCommand = (command: { command: "ping" | "message" | "shutdown"; requestId: string; prompt?: string }) => {
		if (!child.stdin || child.stdin.destroyed) {
			return
		}
		child.stdin.write(`${JSON.stringify(command)}\n`)
	}

	const timeout = setTimeout(() => {
		timedOut = true
		handlerError = new Error(
			`timed out resuming session ${sessionId} (pingSent=${pingSent}, messageSent=${messageSent}, sawMessageControlDone=${sawMessageControlDone}, sawUserTurnWithMarker=${sawUserTurnWithMarker})`,
		)
		child.kill("SIGTERM")
	}, RESUME_TIMEOUT_MS)

	const rl = readline.createInterface({
		input: child.stdout!,
		crlfDelay: Infinity,
	})

	rl.on("line", (line) => {
		process.stdout.write(`${line}\n`)

		const event = parseStreamEvent(line)
		if (!event) {
			return
		}

		if (event.type === "system" && event.subtype === "init" && !pingSent) {
			pingSent = true
			sendCommand({ command: "ping", requestId: pingRequestId })
			return
		}

		if (
			event.type === "control" &&
			event.subtype === "done" &&
			event.command === "ping" &&
			event.requestId === pingRequestId &&
			!messageSent
		) {
			messageSent = true
			sendCommand({
				command: "message",
				requestId: messageRequestId,
				prompt: messagePrompt,
			})
			return
		}

		if (
			event.type === "control" &&
			event.subtype === "error" &&
			event.command === "message" &&
			event.requestId === messageRequestId
		) {
			handlerError = new Error(
				`message command failed while resuming ${sessionId}: code=${event.code ?? "unknown"} content=${event.content ?? ""}`,
			)
			child.kill("SIGTERM")
			return
		}

		if (
			event.type === "control" &&
			event.subtype === "done" &&
			event.command === "message" &&
			event.requestId === messageRequestId
		) {
			sawMessageControlDone = true
			return
		}

		if (event.type === "user" && event.requestId === messageRequestId && event.content?.includes(messageToken)) {
			sawUserTurnWithMarker = true

			if (!shutdownSent) {
				shutdownSent = true
				sendCommand({ command: "shutdown", requestId: shutdownRequestId })
			}
			return
		}

		if (
			event.type === "control" &&
			(event.subtype === "ack" || event.subtype === "done") &&
			event.command === "shutdown" &&
			event.requestId === shutdownRequestId &&
			typeof event.taskId === "string"
		) {
			shutdownTaskId = event.taskId
			return
		}

		if (event.type === "control" && event.subtype === "error" && event.requestId !== shutdownRequestId) {
			handlerError = new Error(
				`unexpected control error while resuming ${sessionId}: command=${event.command ?? "unknown"} code=${event.code ?? "unknown"} content=${event.content ?? ""}`,
			)
			child.kill("SIGTERM")
			return
		}
	})

	const result = await child
	clearTimeout(timeout)
	rl.close()

	if (handlerError) {
		throw handlerError
	}

	if (timedOut) {
		throw new Error(`stream resume for ${sessionId} timed out`)
	}

	if (result.exitCode !== 0) {
		throw new Error(`stream resume for ${sessionId} exited non-zero: ${result.exitCode}`)
	}

	if (!sawMessageControlDone) {
		throw new Error(`did not observe message control completion while resuming ${sessionId}`)
	}

	if (!sawUserTurnWithMarker) {
		throw new Error(`did not observe resumed user marker turn while resuming ${sessionId}`)
	}

	if (shutdownTaskId !== sessionId) {
		throw new Error(
			`shutdown taskId did not match resumed session (expected=${sessionId}, actual=${shutdownTaskId ?? "none"})`,
		)
	}
}

async function main() {
	const cliRoot = process.env.JABBERWOCK_CLI_JABBERWOCKT
		? path.resolve(process.env.JABBERWOCK_CLI_JABBERWOCKT)
		: path.resolve(__dirname, "../../..")
	const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "jabberwock-cli-create-session-id-"))

	const firstSessionId = randomUUID()
	const secondSessionId = randomUUID()
	const firstMarker = `FIRST-MARKER-${Date.now()}`
	const secondMarker = `SECOND-MARKER-${Date.now()}`

	try {
		await createSessionWithCustomId(
			cliRoot,
			workspacePath,
			firstSessionId,
			`Create first session marker ${firstMarker}. Reply with exactly "ok-${firstMarker}".`,
		)
		await createSessionWithCustomId(
			cliRoot,
			workspacePath,
			secondSessionId,
			`Create second session marker ${secondMarker}. Reply with exactly "ok-${secondMarker}".`,
		)

		const initialSessions = await listSessions(cliRoot, workspacePath)
		if (!initialSessions.some((session) => session.id === firstSessionId)) {
			throw new Error(`session list missing first custom session id ${firstSessionId}`)
		}
		if (!initialSessions.some((session) => session.id === secondSessionId)) {
			throw new Error(`session list missing second custom session id ${secondSessionId}`)
		}

		const resumeMarkerForFirst = `resume-first-${Date.now()}`
		await resumeSessionAndSendMarker(cliRoot, workspacePath, firstSessionId, resumeMarkerForFirst)

		const resumeMarkerForSecond = `resume-second-${Date.now()}`
		await resumeSessionAndSendMarker(cliRoot, workspacePath, secondSessionId, resumeMarkerForSecond)

		console.log(`[PASS] created and resumed custom sessions: ${firstSessionId}, ${secondSessionId}`)
	} finally {
		await fs.rm(workspacePath, { recursive: true, force: true })
	}
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
