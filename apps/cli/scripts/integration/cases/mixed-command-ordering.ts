import { runStreamCase, StreamEvent } from "../lib/stream-harness"

const START_PROMPT =
	'Run exactly this command and do not summarize until it finishes: sleep 8 && echo "done". After it finishes, reply with exactly "done".'

async function main() {
	const startRequestId = `start-${Date.now()}`
	const pingARequestId = `ping-a-${Date.now()}`
	const messageRequestId = `message-${Date.now()}`
	const pingBRequestId = `ping-b-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`

	let initSeen = false
	let sentInterleavedCommands = false
	let sentShutdown = false

	const eventOrderByRequestId = new Map<string, string[]>()
	let messageDoneCode: string | undefined
	let messageQueueEnqueuedSeen = false
	let messageResultSeen = false

	function recordControlEvent(event: StreamEvent): void {
		if (!event.requestId || event.type !== "control" || !event.subtype) {
			return
		}
		const existing = eventOrderByRequestId.get(event.requestId) ?? []
		existing.push(event.subtype)
		eventOrderByRequestId.set(event.requestId, existing)
	}

	await runStreamCase({
		onEvent(event: StreamEvent, context) {
			if (event.type === "system" && event.subtype === "init" && !initSeen) {
				initSeen = true
				context.sendCommand({
					command: "start",
					requestId: startRequestId,
					prompt: START_PROMPT,
				})
				return
			}

			recordControlEvent(event)

			if (event.type === "control" && event.subtype === "error") {
				throw new Error(
					`received control error for requestId=${event.requestId ?? "unknown"} command=${event.command ?? "unknown"} code=${event.code ?? "unknown"} content=${event.content ?? ""}`,
				)
			}

			if (
				!sentInterleavedCommands &&
				event.type === "control" &&
				event.subtype === "ack" &&
				event.command === "start" &&
				event.requestId === startRequestId
			) {
				context.sendCommand({
					command: "ping",
					requestId: pingARequestId,
				})
				context.sendCommand({
					command: "message",
					requestId: messageRequestId,
					prompt: 'When this queued message is processed, reply with only "INTERLEAVED".',
				})
				context.sendCommand({
					command: "ping",
					requestId: pingBRequestId,
				})
				sentInterleavedCommands = true
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "done" &&
				event.command === "message" &&
				event.requestId === messageRequestId
			) {
				messageDoneCode = event.code
				return
			}

			if (
				event.type === "queue" &&
				event.subtype === "enqueued" &&
				event.requestId === startRequestId &&
				event.queueDepth === 1
			) {
				messageQueueEnqueuedSeen = true
				return
			}

			if (event.type === "result" && event.done === true && event.requestId === messageRequestId) {
				messageResultSeen = true

				const pingAOrder = eventOrderByRequestId.get(pingARequestId) ?? []
				const pingBOrder = eventOrderByRequestId.get(pingBRequestId) ?? []
				const messageOrder = eventOrderByRequestId.get(messageRequestId) ?? []

				if (pingAOrder.join(",") !== "ack,done") {
					throw new Error(`ping A control order mismatch: ${pingAOrder.join(",") || "none"}`)
				}
				if (pingBOrder.join(",") !== "ack,done") {
					throw new Error(`ping B control order mismatch: ${pingBOrder.join(",") || "none"}`)
				}
				if (messageOrder.join(",") !== "ack,done") {
					throw new Error(`message control order mismatch: ${messageOrder.join(",") || "none"}`)
				}
				if (messageDoneCode !== "queued") {
					throw new Error(
						`expected interleaved message done code \"queued\", got \"${messageDoneCode ?? "none"}\"`,
					)
				}
				if (!messageQueueEnqueuedSeen) {
					throw new Error("expected queue enqueued event after interleaved message")
				}

				if (!sentShutdown) {
					context.sendCommand({
						command: "shutdown",
						requestId: shutdownRequestId,
					})
					sentShutdown = true
				}
			}
		},
		onTimeoutMessage() {
			return [
				"timed out waiting for mixed-command-ordering validation",
				`initSeen=${initSeen}`,
				`sentInterleavedCommands=${sentInterleavedCommands}`,
				`messageDoneCode=${messageDoneCode ?? "none"}`,
				`messageQueueEnqueuedSeen=${messageQueueEnqueuedSeen}`,
				`messageResultSeen=${messageResultSeen}`,
				`pingAOrder=${(eventOrderByRequestId.get(pingARequestId) ?? []).join(",") || "none"}`,
				`messageOrder=${(eventOrderByRequestId.get(messageRequestId) ?? []).join(",") || "none"}`,
				`pingBOrder=${(eventOrderByRequestId.get(pingBRequestId) ?? []).join(",") || "none"}`,
			].join(" ")
		},
	})
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
