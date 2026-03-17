import { runStreamCase, StreamEvent } from "../lib/stream-harness"

const LONG_PROMPT =
	'Run exactly this command and do not summarize until it finishes: sleep 20 && echo "done". After it finishes, reply with exactly "done".'

async function main() {
	const startRequestId = `start-${Date.now()}`
	const messageRequestId = `message-${Date.now()}`
	const shutdownRequestId = `shutdown-${Date.now()}`
	const testImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"

	let initSeen = false
	let startAccepted = false
	let messageAccepted = false
	let messageQueued = false
	let queueImageCountObserved = false
	let shutdownSent = false
	let shutdownAck = false
	let shutdownDone = false

	await runStreamCase({
		timeoutMs: 180_000,
		onEvent(event: StreamEvent, context) {
			if (event.type === "system" && event.subtype === "init" && !initSeen) {
				initSeen = true
				context.sendCommand({ command: "start", requestId: startRequestId, prompt: LONG_PROMPT })
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "ack" &&
				event.command === "start" &&
				event.requestId === startRequestId &&
				!startAccepted
			) {
				startAccepted = true

				context.sendCommand({
					command: "message",
					requestId: messageRequestId,
					prompt: "Respond with exactly IMAGE-QUEUED when this message is processed.",
					images: [testImage],
				})

				return
			}

			if (
				event.type === "control" &&
				event.subtype === "ack" &&
				event.command === "message" &&
				event.requestId === messageRequestId
			) {
				messageAccepted = true
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "done" &&
				event.command === "message" &&
				event.requestId === messageRequestId &&
				event.code === "queued"
			) {
				messageQueued = true
				return
			}

			if (
				event.type === "queue" &&
				(event.subtype === "snapshot" || event.subtype === "enqueued" || event.subtype === "updated") &&
				Array.isArray(event.queue) &&
				event.queue.some((item) => item?.imageCount === 1)
			) {
				queueImageCountObserved = true

				if (!shutdownSent) {
					context.sendCommand({ command: "shutdown", requestId: shutdownRequestId })
					shutdownSent = true
				}

				return
			}

			if (
				event.type === "control" &&
				event.subtype === "ack" &&
				event.command === "shutdown" &&
				event.requestId === shutdownRequestId
			) {
				shutdownAck = true
				return
			}

			if (
				event.type === "control" &&
				event.subtype === "done" &&
				event.command === "shutdown" &&
				event.requestId === shutdownRequestId
			) {
				shutdownDone = true
			}
		},
		onTimeoutMessage() {
			return `timed out waiting for queue image metadata (initSeen=${initSeen}, startAccepted=${startAccepted}, messageAccepted=${messageAccepted}, messageQueued=${messageQueued}, queueImageCountObserved=${queueImageCountObserved}, shutdownSent=${shutdownSent}, shutdownAck=${shutdownAck}, shutdownDone=${shutdownDone})`
		},
	})

	if (!messageAccepted || !messageQueued || !queueImageCountObserved) {
		throw new Error(
			`expected queued message with image metadata (messageAccepted=${messageAccepted}, messageQueued=${messageQueued}, queueImageCountObserved=${queueImageCountObserved})`,
		)
	}

	if (!shutdownAck || !shutdownDone) {
		throw new Error("shutdown control events were not fully observed")
	}
}

main().catch((error) => {
	console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
