import { createInterface } from "readline"

import { isRecord } from "@/lib/utils/guards.js"

import type { ExtensionHost } from "@/agent/index.js"
import type { JsonEventEmitter } from "@/agent/json-event-emitter.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StdinStreamCommandName = "start" | "message" | "cancel" | "ping" | "shutdown"

export type StdinStreamCommand =
	| { command: "start"; requestId: string; prompt: string }
	| { command: "message"; requestId: string; prompt: string }
	| { command: "cancel"; requestId: string }
	| { command: "ping"; requestId: string }
	| { command: "shutdown"; requestId: string }

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export const VALID_STDIN_COMMANDS = new Set<StdinStreamCommandName>(["start", "message", "cancel", "ping", "shutdown"])

export function parseStdinStreamCommand(line: string, lineNumber: number): StdinStreamCommand {
	let parsed: unknown

	try {
		parsed = JSON.parse(line)
	} catch {
		throw new Error(`stdin command line ${lineNumber}: invalid JSON`)
	}

	if (!isRecord(parsed)) {
		throw new Error(`stdin command line ${lineNumber}: expected JSON object`)
	}

	const commandRaw = parsed.command
	const requestIdRaw = parsed.requestId

	if (typeof commandRaw !== "string") {
		throw new Error(`stdin command line ${lineNumber}: missing string "command"`)
	}

	if (!VALID_STDIN_COMMANDS.has(commandRaw as StdinStreamCommandName)) {
		throw new Error(
			`stdin command line ${lineNumber}: unsupported command "${commandRaw}" (expected start|message|cancel|ping|shutdown)`,
		)
	}

	if (typeof requestIdRaw !== "string" || requestIdRaw.trim().length === 0) {
		throw new Error(`stdin command line ${lineNumber}: missing non-empty string "requestId"`)
	}

	const command = commandRaw as StdinStreamCommandName
	const requestId = requestIdRaw.trim()

	if (command === "start" || command === "message") {
		const promptRaw = parsed.prompt
		if (typeof promptRaw !== "string" || promptRaw.trim().length === 0) {
			throw new Error(`stdin command line ${lineNumber}: "${command}" requires non-empty string "prompt"`)
		}

		return { command, requestId, prompt: promptRaw }
	}

	return { command, requestId }
}

// ---------------------------------------------------------------------------
// NDJSON stdin reader
// ---------------------------------------------------------------------------

async function* readCommandsFromStdinNdjson(): AsyncGenerator<StdinStreamCommand> {
	const lineReader = createInterface({
		input: process.stdin,
		crlfDelay: Infinity,
		terminal: false,
	})

	let lineNumber = 0

	try {
		for await (const line of lineReader) {
			lineNumber += 1
			const trimmed = line.trim()
			if (!trimmed) {
				continue
			}
			yield parseStdinStreamCommand(trimmed, lineNumber)
		}
	} finally {
		lineReader.close()
	}
}

// ---------------------------------------------------------------------------
// Queue snapshot helpers
// ---------------------------------------------------------------------------

interface StreamQueueItem {
	id: string
	text?: string
	imageCount: number
	timestamp?: number
}

function normalizeQueueText(text: string | undefined): string | undefined {
	if (!text) {
		return undefined
	}

	const compact = text.replace(/\s+/g, " ").trim()
	if (!compact) {
		return undefined
	}

	return compact.length <= 180 ? compact : `${compact.slice(0, 177)}...`
}

function parseQueueSnapshot(rawQueue: unknown): StreamQueueItem[] | undefined {
	if (!Array.isArray(rawQueue)) {
		return undefined
	}

	const snapshot: StreamQueueItem[] = []

	for (const entry of rawQueue) {
		if (!isRecord(entry)) {
			continue
		}

		const idRaw = entry.id
		if (typeof idRaw !== "string" || idRaw.trim().length === 0) {
			continue
		}

		const imagesRaw = entry.images
		const timestampRaw = entry.timestamp
		const imageCount = Array.isArray(imagesRaw) ? imagesRaw.length : 0

		snapshot.push({
			id: idRaw,
			text: normalizeQueueText(typeof entry.text === "string" ? entry.text : undefined),
			imageCount,
			timestamp: typeof timestampRaw === "number" ? timestampRaw : undefined,
		})
	}

	return snapshot
}

function areStringArraysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) {
		return false
	}

	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false
		}
	}

	return true
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface StdinStreamModeOptions {
	host: ExtensionHost
	jsonEmitter: JsonEventEmitter
	setStreamRequestId: (id: string | undefined) => void
}

function isCancellationLikeError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error)
	const normalized = message.toLowerCase()
	return normalized.includes("aborted") || normalized.includes("cancelled") || normalized.includes("canceled")
}

export async function runStdinStreamMode({ host, jsonEmitter, setStreamRequestId }: StdinStreamModeOptions) {
	let hasReceivedStdinCommand = false
	let shouldShutdown = false
	let activeTaskPromise: Promise<void> | null = null
	let fatalStreamError: Error | null = null
	let activeRequestId: string | undefined
	let activeTaskCommand: "start" | undefined
	let latestTaskId: string | undefined
	let cancelRequestedForActiveTask = false
	let hasSeenQueueState = false
	let lastQueueDepth = 0
	let lastQueueMessageIds: string[] = []

	const waitForPreviousTaskToSettle = async () => {
		if (!activeTaskPromise) {
			return
		}

		try {
			await activeTaskPromise
		} catch {
			// Errors are emitted through control/error events.
		}
	}

	const offClientError = host.client.on("error", (error) => {
		if (cancelRequestedForActiveTask && isCancellationLikeError(error)) {
			if (activeTaskCommand === "start") {
				jsonEmitter.emitControl({
					subtype: "done",
					requestId: activeRequestId,
					command: "start",
					taskId: latestTaskId,
					content: "task cancelled",
					code: "task_aborted",
					success: false,
				})
			}
			activeTaskCommand = undefined
			activeRequestId = undefined
			setStreamRequestId(undefined)
			cancelRequestedForActiveTask = false
			return
		}

		fatalStreamError = error
		jsonEmitter.emitControl({
			subtype: "error",
			requestId: activeRequestId,
			command: activeTaskCommand,
			taskId: latestTaskId,
			content: error.message,
			code: "client_error",
			success: false,
		})
	})

	const onExtensionMessage = (message: {
		type?: string
		state?: {
			currentTaskItem?: { id?: unknown }
			messageQueue?: unknown
		}
	}) => {
		if (message.type !== "state") {
			return
		}

		const currentTaskId = message.state?.currentTaskItem?.id
		if (typeof currentTaskId === "string" && currentTaskId.trim().length > 0) {
			latestTaskId = currentTaskId
		}

		const queueSnapshot = parseQueueSnapshot(message.state?.messageQueue)
		if (!queueSnapshot) {
			return
		}

		const queueDepth = queueSnapshot.length
		const queueMessageIds = queueSnapshot.map((item) => item.id)

		if (!hasSeenQueueState) {
			hasSeenQueueState = true
			lastQueueDepth = queueDepth
			lastQueueMessageIds = queueMessageIds

			if (queueDepth === 0) {
				return
			}

			jsonEmitter.emitQueue({
				subtype: "snapshot",
				taskId: latestTaskId,
				content: `queue snapshot (${queueDepth} item${queueDepth === 1 ? "" : "s"})`,
				queueDepth,
				queue: queueSnapshot,
			})
			return
		}

		const depthChanged = queueDepth !== lastQueueDepth
		const idsChanged = !areStringArraysEqual(queueMessageIds, lastQueueMessageIds)

		if (!depthChanged && !idsChanged) {
			return
		}

		const subtype: "enqueued" | "dequeued" | "drained" | "updated" = depthChanged
			? queueDepth > lastQueueDepth
				? "enqueued"
				: queueDepth === 0
					? "drained"
					: "dequeued"
			: "updated"

		const content =
			subtype === "drained"
				? "queue drained"
				: `queue ${subtype} (${queueDepth} item${queueDepth === 1 ? "" : "s"})`

		jsonEmitter.emitQueue({
			subtype,
			taskId: latestTaskId,
			content,
			queueDepth,
			queue: queueSnapshot,
		})

		lastQueueDepth = queueDepth
		lastQueueMessageIds = queueMessageIds
	}

	host.on("extensionWebviewMessage", onExtensionMessage)

	const offTaskCompleted = host.client.on("taskCompleted", (event) => {
		if (activeTaskCommand === "start") {
			const completionCode = event.success
				? "task_completed"
				: cancelRequestedForActiveTask
					? "task_aborted"
					: "task_failed"

			jsonEmitter.emitControl({
				subtype: "done",
				requestId: activeRequestId,
				command: "start",
				taskId: latestTaskId,
				content: event.success
					? "task completed"
					: cancelRequestedForActiveTask
						? "task cancelled"
						: "task failed",
				code: completionCode,
				success: event.success,
			})
			activeTaskCommand = undefined
			activeRequestId = undefined
			setStreamRequestId(undefined)
			cancelRequestedForActiveTask = false
		}
	})

	try {
		for await (const stdinCommand of readCommandsFromStdinNdjson()) {
			hasReceivedStdinCommand = true

			if (fatalStreamError) {
				throw fatalStreamError
			}

			switch (stdinCommand.command) {
				case "start":
					// A task can emit completion events before runTask() finalizers run.
					// Wait for full settlement to avoid false "task_busy" on immediate next start.
					// Safe from races: `for await` processes stdin commands serially, so no
					// concurrent command can mutate state between the check and the await.
					if (activeTaskPromise && !host.client.hasActiveTask()) {
						await waitForPreviousTaskToSettle()
					}

					if (activeTaskPromise || host.client.hasActiveTask()) {
						jsonEmitter.emitControl({
							subtype: "error",
							requestId: stdinCommand.requestId,
							command: "start",
							taskId: latestTaskId,
							content: "cannot start a new task while another task is active",
							code: "task_busy",
							success: false,
						})
						break
					}

					activeRequestId = stdinCommand.requestId
					activeTaskCommand = "start"
					setStreamRequestId(stdinCommand.requestId)
					latestTaskId = undefined
					cancelRequestedForActiveTask = false

					jsonEmitter.emitControl({
						subtype: "ack",
						requestId: stdinCommand.requestId,
						command: "start",
						taskId: latestTaskId,
						content: "starting task",
						code: "accepted",
						success: true,
					})

					activeTaskPromise = host
						.runTask(stdinCommand.prompt)
						.catch((error) => {
							const message = error instanceof Error ? error.message : String(error)

							if (cancelRequestedForActiveTask || isCancellationLikeError(error)) {
								if (activeTaskCommand === "start") {
									jsonEmitter.emitControl({
										subtype: "done",
										requestId: stdinCommand.requestId,
										command: "start",
										taskId: latestTaskId,
										content: "task cancelled",
										code: "task_aborted",
										success: false,
									})
								}
								activeTaskCommand = undefined
								activeRequestId = undefined
								setStreamRequestId(undefined)
								cancelRequestedForActiveTask = false
								return
							}

							fatalStreamError = error instanceof Error ? error : new Error(message)
							activeTaskCommand = undefined
							activeRequestId = undefined
							setStreamRequestId(undefined)
							jsonEmitter.emitControl({
								subtype: "error",
								requestId: stdinCommand.requestId,
								command: "start",
								taskId: latestTaskId,
								content: message,
								code: "task_error",
								success: false,
							})
						})
						.finally(() => {
							activeTaskPromise = null
						})
					break

				case "message":
					if (!host.client.hasActiveTask()) {
						jsonEmitter.emitControl({
							subtype: "error",
							requestId: stdinCommand.requestId,
							command: "message",
							taskId: latestTaskId,
							content: "no active task; send a start command first",
							code: "no_active_task",
							success: false,
						})
						break
					}

					setStreamRequestId(stdinCommand.requestId)
					jsonEmitter.emitControl({
						subtype: "ack",
						requestId: stdinCommand.requestId,
						command: "message",
						taskId: latestTaskId,
						content: "message accepted",
						code: "accepted",
						success: true,
					})
					host.sendToExtension({ type: "queueMessage", text: stdinCommand.prompt })
					jsonEmitter.emitControl({
						subtype: "done",
						requestId: stdinCommand.requestId,
						command: "message",
						taskId: latestTaskId,
						content: "message queued",
						code: "queued",
						success: true,
					})
					break

				case "cancel": {
					setStreamRequestId(stdinCommand.requestId)

					const hasTaskInFlight = Boolean(
						activeTaskPromise || activeTaskCommand === "start" || host.client.hasActiveTask(),
					)

					if (!hasTaskInFlight) {
						jsonEmitter.emitControl({
							subtype: "ack",
							requestId: stdinCommand.requestId,
							command: "cancel",
							taskId: latestTaskId,
							content: "no active task to cancel",
							code: "accepted",
							success: true,
						})
						jsonEmitter.emitControl({
							subtype: "done",
							requestId: stdinCommand.requestId,
							command: "cancel",
							taskId: latestTaskId,
							content: "cancel ignored (no active task)",
							code: "no_active_task",
							success: true,
						})
						break
					}

					cancelRequestedForActiveTask = true
					jsonEmitter.emitControl({
						subtype: "ack",
						requestId: stdinCommand.requestId,
						command: "cancel",
						taskId: latestTaskId,
						content: host.client.hasActiveTask() ? "cancel requested" : "cancel requested (task starting)",
						code: "accepted",
						success: true,
					})
					try {
						host.client.cancelTask()
						jsonEmitter.emitControl({
							subtype: "done",
							requestId: stdinCommand.requestId,
							command: "cancel",
							taskId: latestTaskId,
							content: "cancel signal sent",
							code: "cancel_requested",
							success: true,
						})
					} catch (error) {
						if (!isCancellationLikeError(error)) {
							const message = error instanceof Error ? error.message : String(error)
							jsonEmitter.emitControl({
								subtype: "error",
								requestId: stdinCommand.requestId,
								command: "cancel",
								taskId: latestTaskId,
								content: message,
								code: "cancel_error",
								success: false,
							})
						}
					}
					break
				}

				case "ping":
					jsonEmitter.emitControl({
						subtype: "ack",
						requestId: stdinCommand.requestId,
						command: "ping",
						taskId: latestTaskId,
						content: "pong",
						code: "accepted",
						success: true,
					})
					jsonEmitter.emitControl({
						subtype: "done",
						requestId: stdinCommand.requestId,
						command: "ping",
						taskId: latestTaskId,
						content: "pong",
						code: "pong",
						success: true,
					})
					break

				case "shutdown":
					jsonEmitter.emitControl({
						subtype: "ack",
						requestId: stdinCommand.requestId,
						command: "shutdown",
						taskId: latestTaskId,
						content: "shutdown requested",
						code: "accepted",
						success: true,
					})
					jsonEmitter.emitControl({
						subtype: "done",
						requestId: stdinCommand.requestId,
						command: "shutdown",
						taskId: latestTaskId,
						content: "shutting down process",
						code: "shutdown_requested",
						success: true,
					})
					shouldShutdown = true
					break
			}

			if (shouldShutdown) {
				break
			}
		}

		if (!hasReceivedStdinCommand) {
			throw new Error("no stdin command provided")
		}

		if (shouldShutdown && host.client.hasActiveTask()) {
			host.client.cancelTask()
		}

		if (!shouldShutdown && host.client.hasActiveTask() && host.isWaitingForInput()) {
			const currentAsk = host.client.getCurrentAsk()
			throw new Error(`stdin ended while task was waiting for input (${currentAsk ?? "unknown"})`)
		}

		if (!shouldShutdown && activeTaskPromise) {
			await activeTaskPromise
		}
	} finally {
		offClientError()
		host.off("extensionWebviewMessage", onExtensionMessage)
		offTaskCompleted()
	}
}
